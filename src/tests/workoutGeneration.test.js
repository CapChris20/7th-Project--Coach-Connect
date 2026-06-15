/**
 * workout Generation test
 *
 * Purpose: Tests for workout Generation test.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/tests
 * Key exports: (see file)
 *
 * @file-header
 */
const fs = require("fs");

// Load .env for local runs
require("dotenv").config();

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8001";
const FIREBASE_ID_TOKEN = process.env.TEST_FIREBASE_ID_TOKEN || "";

const GOALS = ["Body Recomp", "Strength", "Hypertrophy", "Weight Loss"];

const EXPECTED_FIELDS = ["name", "sets", "reps", "rest"];
const RESULTS = [];
const ARTIFACTS_DIR = "src/tests/artifacts";
const MAX_TARGET_MS = 5000;

if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const generateWorkoutPrompt = (goal) => `
Generate a realistic 5-day workout plan for someone with the goal: ${goal}

Requirements:
- Return ONLY valid JSON (no markdown, no backticks)
- Structure exactly as shown below
- Each exercise must have sets, reps (as string like "5-6" or "8-12"), and rest period
- Make sets/reps/rest appropriate for the goal:
  * Body Recomp: 6-8 reps, 2-3 min rest
  * Strength: 3-5 reps, 3-5 min rest
  * Hypertrophy: 8-12 reps, 1-2 min rest
  * Weight Loss: 10-15 reps, short rest, include some cardio

JSON Structure:
{
  "goal": "${goal}",
  "summary": "Brief description of the plan",
  "trainingDays": [
    {
      "day": "Monday",
      "type": "Push",
      "focus": "Chest, shoulders, triceps",
      "exercises": [
        {
          "name": "Bench Press",
          "sets": 4,
          "reps": "5-6",
          "rest": "3 min",
          "notes": "Heavy compound"
        }
      ]
    }
  ]
}
`;

const strictJsonRetryPrompt = (goal, error) => `
Your previous response was not valid JSON and failed parsing with:
${error}

Re-generate the workout plan for goal: ${goal}

Rules (non-negotiable):
- Output must be ONLY valid JSON
- Do NOT include any trailing commas
- Do NOT include any commentary before or after JSON
- Must include exactly 5 objects in "trainingDays"
`;

async function callClaudeMessages(prompt) {
  const res = await fetch(`${API_BASE_URL}/api/workout/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${FIREBASE_ID_TOKEN}`,
    },
    body: JSON.stringify({
      goal: "Test",
      userPrompt: prompt,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  
  const data = JSON.parse(text);
  if (!data.message) throw new Error("No message in response");
  
  return {
    content: [{ text: data.message }],
  };
}

function extractResponseText(message) {
  const responseText = Array.isArray(message?.content)
    ? message.content.map((b) => b?.text || "").join("")
    : "";
  if (!responseText.trim()) throw new Error("Empty response text");
  return responseText;
}

function parseJsonFromResponseText(responseText) {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]);
}

function validateWorkoutPlan(plan, goal) {
  const errors = [];
  const warnings = [];

  // Check structure
  if (!plan.goal) errors.push("Missing 'goal' field");
  if (!plan.trainingDays || !Array.isArray(plan.trainingDays)) {
    errors.push("Missing or invalid 'trainingDays' array");
    return { errors, warnings, valid: false };
  }

  if (plan.trainingDays.length !== 5) {
    warnings.push(`Expected 5 training days, got ${plan.trainingDays.length}`);
  }

  // Check each day
  plan.trainingDays.forEach((day, idx) => {
    if (!day.day) errors.push(`Day ${idx + 1}: Missing 'day' field`);
    if (!day.type) errors.push(`Day ${idx + 1}: Missing 'type' field`);
    if (!Array.isArray(day.exercises)) {
      errors.push(`Day ${idx + 1}: Missing or invalid 'exercises' array`);
      return;
    }

    if (day.exercises.length === 0) {
      warnings.push(`Day ${idx + 1}: No exercises listed`);
    }

    // Check each exercise
    day.exercises.forEach((ex, exIdx) => {
      EXPECTED_FIELDS.forEach((field) => {
        if (!(field in ex)) {
          errors.push(`Day ${idx + 1}, Exercise ${exIdx + 1}: Missing '${field}'`);
        }
      });

      // Validate reps format
      if (ex.reps && typeof ex.reps === "string") {
        // allow "6-8 per leg" etc as a warning instead of noisy false positives
        if (!/^\d+(-\d+)?(\s+per\s+\w+)?$/.test(ex.reps.trim())) {
          warnings.push(`Day ${idx + 1}, ${ex.name}: Reps format odd: "${ex.reps}"`);
        }
      }

      // Validate rest format
      if (ex.rest && typeof ex.rest === "string") {
        if (!/\d+\s*(min|hour|sec)/.test(ex.rest.toLowerCase())) {
          warnings.push(`Day ${idx + 1}, ${ex.name}: Rest format odd: "${ex.rest}"`);
        }
      }
    });
  });

  // Goal-specific checks
  const totalExercises = plan.trainingDays.reduce((sum, day) => sum + day.exercises.length, 0);

  if (goal === "Strength" && totalExercises > 20) {
    warnings.push("Strength goal should have fewer total exercises (more focus)");
  }

  if (goal === "Hypertrophy" && totalExercises < 25) {
    warnings.push("Hypertrophy goal should have more total exercises (more volume)");
  }

  if (goal === "Weight Loss") {
    const hasCardio = plan.trainingDays.some((day) =>
      day.exercises.some((ex) => {
        const n = String(ex.name || "").toLowerCase();
        return n.includes("cardio") || n.includes("run") || n.includes("bike");
      })
    );
    if (!hasCardio) {
      warnings.push("Weight Loss goal should include some cardio");
    }
  }

  return {
    errors,
    warnings,
    valid: errors.length === 0,
    totalExercises,
  };
}

async function testWorkoutGeneration() {
  if (!FIREBASE_ID_TOKEN) {
    console.error(
      "Missing TEST_FIREBASE_ID_TOKEN. Set it before running this test."
    );
    process.exit(1);
  }

  console.log("\n🏋️  WORKOUT GENERATION TEST QA\n");
  console.log("Testing Claude API workout generation for all goals...\n");
  console.log("=".repeat(70));

  for (const goal of GOALS) {
    const testResult = {
      goal,
      startTime: Date.now(),
      success: false,
      error: null,
      validation: null,
      responseTime: 0,
    };

    try {
      console.log(`\n📋 Testing: ${goal}`);
      console.log("-".repeat(70));

      // Call Claude API (Messages)
      const prompt = generateWorkoutPrompt(goal);
      const message = await callClaudeMessages(prompt);

      testResult.responseTime = Date.now() - testResult.startTime;
      const responseText = extractResponseText(message);
      fs.writeFileSync(
        `${ARTIFACTS_DIR}/${goal.replace(/\s+/g, "_").toLowerCase()}_raw.txt`,
        responseText
      );

      // Parse JSON
      let plan;
      try {
        plan = parseJsonFromResponseText(responseText);
      } catch (parseError) {
        // One retry with strict JSON-only instruction
        const retryMsg = await callClaudeMessages(
          strictJsonRetryPrompt(goal, parseError.message)
        );
        const retryText = extractResponseText(retryMsg);
        fs.writeFileSync(
          `${ARTIFACTS_DIR}/${goal.replace(/\s+/g, "_").toLowerCase()}_retry_raw.txt`,
          retryText
        );
        try {
          plan = parseJsonFromResponseText(retryText);
        } catch (parseError2) {
          throw new Error(`Failed to parse JSON: ${parseError2.message}`);
        }
      }

      // Validate
      const validation = validateWorkoutPlan(plan, goal);
      testResult.validation = validation;
      testResult.success = validation.valid;

      // Log results
      if (validation.valid) {
        console.log(`✅ PASS`);
        console.log(`   Response time: ${testResult.responseTime}ms`);
        if (testResult.responseTime > MAX_TARGET_MS) {
          console.log(`   ⚠️  Warning: Response time exceeded 5000ms`);
        }
        console.log(`   Training days: ${plan.trainingDays.length}`);
        console.log(`   Total exercises: ${validation.totalExercises}`);
        console.log(`   First day: ${plan.trainingDays[0].day} (${plan.trainingDays[0].type})`);
        console.log(
          `   Exercises in first day: ${plan.trainingDays[0].exercises.map((ex) => ex.name).join(", ")}`
        );
      } else {
        console.log(`❌ FAIL`);
        console.log(`   Response time: ${testResult.responseTime}ms`);
        validation.errors.forEach((err) => console.log(`   ERROR: ${err}`));
      }

      if (validation.warnings.length > 0) {
        console.log(`   ⚠️  Warnings:`);
        validation.warnings.slice(0, 3).forEach((warn) => {
          console.log(`      - ${warn}`);
        });
      }
    } catch (error) {
      testResult.error = error.message;
      console.log(`❌ FAIL`);
      console.log(`   ERROR: ${error.message}`);
    }

    RESULTS.push(testResult);

    // Rate limit pause
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 TEST SUMMARY\n");

  const passed = RESULTS.filter((r) => r.success).length;
  const total = RESULTS.length;
  const avgResponseTime = Math.round(RESULTS.reduce((sum, r) => sum + r.responseTime, 0) / RESULTS.length);

  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Average Response Time: ${avgResponseTime}ms`);
  console.log(`All Goals Tested: ${GOALS.join(", ")}`);

  // Goal-by-goal summary
  RESULTS.forEach((result) => {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${status} - ${result.goal}`);
  });

  // Final verdict
  console.log("\n" + "=".repeat(70));
  if (passed === total) {
    console.log("✅ ALL TESTS PASSED - Workout generation is working!\n");
  } else {
    console.log(`❌ ${total - passed} TEST(S) FAILED - Review errors above\n`);
    process.exit(1);
  }

  // Save results to file
  fs.writeFileSync("workout-generation-test-results.json", JSON.stringify(RESULTS, null, 2));
  console.log("Results saved to: workout-generation-test-results.json\n");
}

// Run tests
testWorkoutGeneration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

