#!/usr/bin/env bash
# Patch React Native 0.81.x TurboModule void-method handler for iOS 26+.
# Uncaught NSExceptions in async void TurboModules crash at launch (SIGABRT) on
# com.meta.react.turbomodulemanager.queue — see facebook/react-native#53960, #54859.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RN_MM="${ROOT}/node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm"

if [[ ! -f "$RN_MM" ]]; then
  echo "⚠ patchReactNativeTurboModuleIos26: RCTTurboModule.mm not found — skip"
  exit 0
fi

PATCH_MARKER="CoachConnect iOS 26 TurboModule void exception patch"
if grep -q "$PATCH_MARKER" "$RN_MM"; then
  echo "✓ RCTTurboModule.mm already patched for iOS 26"
  exit 0
fi

python3 - "$RN_MM" "$PATCH_MARKER" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
marker = sys.argv[2]
text = path.read_text()

pattern = re.compile(
    r"(void ObjCTurboModule::performVoidMethodInvocation\([\s\S]*?"
    r"@catch \(NSException \*exception\) \{\n)"
    r"      throw convertNSExceptionToJSError\(runtime, exception, std::string\{moduleName\}, methodNameStr\);\n"
    r"(    \} @finally \{\n"
    r"      \[retainedObjectsForInvocation removeAllObjects\];\n"
    r"    \}\n\n"
    r"    if \(shouldVoidMethodsExecuteSync_\) \{\n"
    r"      TurboModulePerfLogger::syncMethodCallExecutionEnd\(moduleName, methodName\);\n"
    r"    \} else \{\n"
    r"      TurboModulePerfLogger::asyncMethodCallExecutionEnd\(moduleName, methodName, asyncCallCounter\);\n"
    r"    \}\n\n"
    r"    return;\n"
    r"  \};)",
    re.MULTILINE,
)

replacement = (
    r"\1"
    f"      // {marker}\n"
    "      // Void TurboModule calls are async; rethrowing or converting to JSError on this\n"
    "      // queue crashes on iOS 26 (SIGABRT / Hermes heap corruption). Log and return.\n"
    '      RCTLogError(@"[TurboModule] Exception in void method %s.%s: %@", moduleName, methodNameStr.c_str(), exception);\n'
    "      if (shouldVoidMethodsExecuteSync_) {\n"
    "        TurboModulePerfLogger::syncMethodCallExecutionEnd(moduleName, methodName);\n"
    "      } else {\n"
    "        TurboModulePerfLogger::asyncMethodCallExecutionEnd(moduleName, methodName, asyncCallCounter);\n"
    "      }\n"
    "      return;\n"
    r"\2"
)

new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    print("⚠ patchReactNativeTurboModuleIos26: performVoidMethodInvocation catch block not found — skip")
    sys.exit(0)

path.write_text(new_text)
print("✓ Patched RCTTurboModule.mm for iOS 26 TurboModule void exceptions")
PY
