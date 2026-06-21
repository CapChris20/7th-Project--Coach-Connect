/**
 * Adjust Macros Modal
 *
 * Purpose: UI screen or component: Adjust Macros Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: AdjustMacroTargetsSheet
 *
 * @file-header
 */
import React, { useState, useEffect } from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../app-start/config';

export default function AdjustMacroTargetsSheet({ params, reasoning, onConfirm, onCancel, loading }) {
  const [currentMacros, setCurrentMacros] = useState(null);

  useEffect(() => {
    const loadCurrentMacros = async () => {
      try {
        if (!auth.currentUser) return;
        const goalsRef = doc(db, 'nutrition_goals', auth.currentUser.uid);
        const snap = await getDoc(goalsRef);
        if (snap.exists()) {
          const data = snap.data();
          setCurrentMacros({
            protein: data.protein_target || data.protein || 150,
            carbs: data.carbs_target || data.carbs || 200,
            fat: data.fat_target || data.fat || 65,
          });
        }
      } catch (e) {
        console.warn('Failed to load current macros:', e.message);
      }
    };
    loadCurrentMacros();
  }, []);

  // Use current macros as intelligent defaults if not specified by AI
  const defaultP = currentMacros?.protein ?? 150;
  const defaultC = currentMacros?.carbs ?? 200;
  const defaultF = currentMacros?.fat ?? 65;

  const p = Number(params?.newProtein ?? params?.protein) ?? defaultP;
  const c = Number(params?.newCarbs ?? params?.carbs) ?? defaultC;
  const f = Number(params?.newFats ?? params?.fats ?? params?.fat) ?? defaultF;
  
  // Ensure we have valid numbers
  const proteinVal = Number.isFinite(p) ? p : defaultP;
  const carbsVal = Number.isFinite(c) ? c : defaultC;
  const fatVal = Number.isFinite(f) ? f : defaultF;

  const explicitCal = Number(params?.calories ?? params?.newCals);
  const kcal =
    Number.isFinite(explicitCal) && explicitCal >= 800
      ? explicitCal
      : Math.round(proteinVal * 4 + carbsVal * 4 + fatVal * 9);

  // Merge AI suggestions with current values to avoid losing data
  const mergedParams = {
    ...params,
    protein: proteinVal,
    carbs: carbsVal,
    fat: fatVal,
    calories: kcal,
  };

  return (
    <ToolModalBody title="Update nutrition targets?" reasoning={reasoning}>
      <DetailRow label="Daily calories" value={`${kcal} kcal`} />
      <DetailRow label="Protein" value={`${proteinVal}g`} />
      <DetailRow label="Carbs" value={`${carbsVal}g`} />
      <DetailRow label="Fat" value={`${fatVal}g`} />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow onConfirm={() => onConfirm(mergedParams)} onCancel={onCancel} loading={loading} />
    </ToolModalBody>
  );
}
