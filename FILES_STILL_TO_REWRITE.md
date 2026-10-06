# Files still to rewrite

261 app files in `src/` still fail the style checker. 172 already pass.

Same behavior when these get rewritten. The 30-line cap is not in use. Tests under `src/__tests__` stay as they are. Firebase project id stays `anatrox-auth`.

14 files are 1,500 lines or longer. Those are their own small groups at the end, because a Metro failure has to be restorable without wiping earlier files.

- Normal files: 247
- Giant screens: 14

## Giant screens

| Lines | File | Why it fails |
|---:|---|---|
| 5612 | `src/workouts/create-plan/CreateWorkoutPlanScreen.js` | 18 cryptic names (n@133, t@135, s@188, v@849); nesting 3+: formatProfileHeightDisplay depth 3 @119; normalizeStructuredPlanForViewer depth 3 @782; long and nested: normalizeStructuredPlanForViewer 81 lines @782; parsePlan 122 lines @1545; missing the three section headers; 10 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 5021 | `src/login-and-signup/NewUserSetupScreen.jsx` | 8 cryptic names (g@146, bg@181, t@1352, H@1353); nesting 3+: postOnboardingApi depth 5 @1736; generateInviteCode depth 3 @1808; long and nested: handleFinish 126 lines @2064; anonymous 90 lines @2740; missing the three section headers; export missing JSDoc @144,170,283; 25 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 3532 | `src/login-and-signup/LoginScreen.js` | 2 cryptic names (s@108, t@494); nesting 3+: validateSignupForm depth 3 @652; handleSignup depth 4 @686; long and nested: handleSignup 119 lines @686; handleGoogleSignUp 81 lines @806; missing the three section headers; 10 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 2764 | `src/client-app/home/TrainingHomeScreen.jsx` | 32 cryptic names (h@96, m@97, s@98, s@168); nesting 3+: load depth 4 @237; save depth 4 @309; missing the three section headers; export missing JSDoc @1537; 27 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1985 | `src/ai-coach/conversation/CoachConversationScreen.jsx` | 4 cryptic names (t@168, p@172, t@438, t@1032); nesting 3+: formatToolActionSummary depth 3 @167; handleToolConfirm depth 3 @1173; long and nested: formatToolActionSummary 144 lines @167; handleToolConfirm 130 lines @1173; missing the three section headers; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1933 | `src/trainer-app/weekly-report/WeeklyReportBars.jsx` | 35 cryptic names (t@127, n@281, n@289, n@294); nesting 3+: buildHeroHighlights depth 3 @384; parseStructuredDayNote depth 4 @561; long and nested: parseStructuredDayNote 133 lines @561; missing the three section headers; export missing JSDoc @168,330,526; 5 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1847 | `src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx` | 5 cryptic names (n@42, c@398, d@488, t@620); missing the three section headers; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1830 | `src/client-app/profile/MyProfileScreen.jsx` | 12 cryptic names (m@121, n@134, n@150, t@152); nesting 3+: handleAddCertification depth 4 @667; saveField depth 6 @949; long and nested: handleAddCertification 92 lines @667; missing the three section headers; 7 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1801 | `src/client-app/home/homeLooks.js` | missing the three section headers |
| 1723 | `src/app-start/ClientAppStart.js` | 4 cryptic names (t@208, d@1016, f@1107, n@1236); nesting 3+: reconcileTrainerId depth 5 @448; anonymous depth 3 @572; long and nested: reconcileTrainerId 104 lines @448; anonymous 118 lines @730; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1689 | `src/workouts/exercise-videos/ExerciseVideosTab.jsx` | 10 cryptic names (w@59, c@157, s@295, t@305); nesting 3+: inferMusclesFromText depth 3 @301; anonymous depth 5 @587; long and nested: buildJourneyKeywordPillsFromCorpus 123 lines @156; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1582 | `src/app-start/TrainerAppStart.js` | 7 cryptic names (h@185, r@187, g@188, b@189); nesting 3+: getTrainerClients depth 6 @468; getClientAnalytics depth 3 @874; long and nested: createOrUpdateClient 113 lines @269; checkWeeklyDataAvailability 89 lines @932; missing the three section headers; export missing JSDoc @605,640,683; 10 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1515 | `src/trainer-app/documents/SpreadsheetEditor.js` | 28 cryptic names (t@53, t@183, r@297, c@298); nesting 3+: anonymous depth 3 @322; anonymous depth 3 @366; missing the three section headers; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1505 | `src/ai-coach/home-screen/CoachHomeScreen.jsx` | 4 cryptic names (s@113, s@130, s@217, t@930); nesting 3+: buildDynamicSuggestions depth 3 @234; missing the three section headers; 7 inline rule-numbers (timeouts, status codes, or day/hour math) |

## The rest, shortest first

| Lines | File | Why it fails |
|---:|---|---|
| 83 | `src/for-both/payments/whenToAskForPayoutSetup.js` | 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 90 | `src/helpers/combineTraineeProfile.js` | nesting 3+: copyClientOwnedFields depth 3 @47 |
| 97 | `src/messaging/markMessagesRead.js` | 1 cryptic names (q@28); missing the three section headers; export missing JSDoc @20,76 |
| 98 | `src/nutrition/daily-log/MacroBar.js` | missing the three section headers |
| 99 | `src/for-both/weekly-report/ColorButton.jsx` | no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @8 |
| 99 | `src/login-and-signup/checkTrainerCode.js` | 1 cryptic names (s@10); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 99 | `src/notifications/writeAlertText.js` | 7 cryptic names (t@33, t@38, t@56, t@70); missing the three section headers; export missing JSDoc @37,48,65 |
| 101 | `src/for-both/online-connection/checkConnectionHealth.js` | missing the three section headers |
| 102 | `src/client-app/navigation/ClientScreenList.jsx` | missing the three section headers |
| 105 | `src/ai-coach/conversation/photoPermissions.js` | missing the three section headers |
| 105 | `src/for-both/online-connection/linkTrainerAndTrainee.js` | nesting 3+: postTrainerJson depth 3 @33 |
| 108 | `src/ai-coach/conversation/copyReplyText.js` | nesting 3+: copyCoachText depth 3 @75 |
| 109 | `src/look-and-feel/GlassCard.jsx` | missing the three section headers |
| 110 | `src/ai-coach/conversation/preparePhotosToSend.js` | nesting 3+: preparePhotosToSendForApi depth 3 @80 |
| 110 | `src/ai-coach/past-chats/chatHistoryList.js` | 2 cryptic names (s@18, q@60); no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @7,17,33; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 111 | `src/workouts/create-plan/workoutPlanCreation.js` | 1 cryptic names (d@30); missing the three section headers; export missing JSDoc @18 |
| 113 | `src/for-both/weekly-report/WinsAndWorkOnsSection.jsx` | no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @31 |
| 116 | `src/ai-coach/conversation/PasteTextPopup.jsx` | 1 cryptic names (bg@41); missing the three section headers |
| 118 | `src/for-both/payments/TrainerPayoutSetupPopup.jsx` | 1 cryptic names (bg@44); missing the three section headers; export missing JSDoc @35 |
| 119 | `src/for-both/loading-and-header/StartupLoadingCover.js` | missing the three section headers; export missing JSDoc @24,43 |
| 119 | `src/helpers/showSetupAnswers.js` | 2 cryptic names (s@74, n@114); missing the three section headers |
| 119 | `src/trainer-app/documents/exportDocument.js` | missing the three section headers |
| 122 | `src/trainer-app/new-requests/pendingRequestCount.js` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 123 | `src/messaging/unreadMessageCounts.js` | 1 cryptic names (d@109); missing the three section headers; export missing JSDoc @33,37 |
| 123 | `src/workouts/exercise-videos/dislikableExercises.js` | 1 cryptic names (q@119); missing the three section headers; export missing JSDoc @114,118 |
| 124 | `src/for-both/weekly-report/loadWeekDailyEntries.js` | 1 cryptic names (d@6); no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @46,121 |
| 124 | `src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx` | 3 cryptic names (s@20, a@24, b@25); missing the three section headers |
| 127 | `src/trainer-app/progress-tab/ProgressTopCard.jsx` | 1 cryptic names (bg@26); missing the three section headers |
| 128 | `src/for-both/weekly-report/StatCard.jsx` | no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @20 |
| 128 | `src/trainer-pro-plan/proAccessRules.js` | 1 cryptic names (d@24); missing the three section headers; 7 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 129 | `src/trainer-app/documents/spreadsheet-grid/cellFormatting.js` | 6 cryptic names (s@11, d@41, n@64, n@74); nesting 3+: formatValue depth 3 @56; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 129 | `src/trainer-app/scheduling/SessionTimePicker.jsx` | missing the three section headers |
| 131 | `src/client-app/files-and-notes/TrainerSharedFilesPopup.jsx` | 1 cryptic names (bg@41); missing the three section headers |
| 131 | `src/trainer-app/documents/readingLevel.js` | 1 cryptic names (w@122); nesting 3+: computeStats depth 4 @31; missing the three section headers; export missing JSDoc @31; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 131 | `src/trainer-app/workout-plans/builtInExerciseList.js` | 1 cryptic names (q@97); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 131 | `src/workouts/create-plan/askForWorkoutPlan.js` | nesting 3+: askForWorkoutPlanFromApi depth 4 @25; missing the three section headers; export missing JSDoc @25,100,121; 6 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 132 | `src/login-and-signup/decideTraineeOrTrainer.js` | missing the three section headers; 7 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 134 | `src/for-both/payments/trainerPayoutSetupFlow.js` | missing the three section headers |
| 136 | `src/nutrition/food-cards/foodCardText.js` | 2 cryptic names (m@40, n@42); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 136 | `src/trainer-app/my-trainees/pagedTraineeList.js` | 1 cryptic names (c@82); missing the three section headers |
| 138 | `src/ai-coach/coach-actions/popupOrAutoRun.js` | missing the three section headers; export missing JSDoc @67,74,125; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 139 | `src/trainer-app/documents/spreadsheet-grid/columnWidths.js` | 4 cryptic names (w@102, h@111, c@135, r@136); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 140 | `src/client-app/find-a-trainer/sendConnectionRequest.js` | 1 cryptic names (t@121); missing the three section headers; export missing JSDoc @39 |
| 143 | `src/trainer-app/documents/editorAccent.jsx` | missing the three section headers |
| 145 | `src/client-app/find-a-trainer/FrostedPanel.jsx` | missing the three section headers |
| 145 | `src/daily-stats/saveYesterdaysStats.js` | missing the three section headers |
| 145 | `src/trainer-app/documents/editorColors.js` | 1 cryptic names (c@59); missing the three section headers; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 146 | `src/trainer-app/documents/spreadsheet-grid/FormulaBar.jsx` | nesting 3+: anonymous depth 3 @61; missing the three section headers |
| 147 | `src/for-both/weekly-report/NoReportYet.jsx` | no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @15 |
| 148 | `src/trainer-app/trainee-records/loadMyLinkedTrainees.js` | 2 cryptic names (q@65, c@91); nesting 3+: loadMyLinkedTrainees depth 4 @82; missing the three section headers |
| 150 | `src/for-both/weekly-report/writeTrainerTips.js` | 1 cryptic names (n@3); no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @14,27,51; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 151 | `src/trainer-app/new-requests/loadPendingTraineeRequests.js` | nesting 3+: getTrainerPendingRequests depth 3 @127 |
| 153 | `src/navigation/goToScreenByKeyword.js` | long and nested: anonymous 108 lines @27; missing the three section headers |
| 154 | `src/nutrition/food-details/FoodItem.js` | 1 cryptic names (s@83); missing the three section headers |
| 155 | `src/nutrition/food-details/servingSizeMath.js` | 7 cryptic names (n@22, g@61, s@108, q@120); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 156 | `src/for-both/icons/OutlinedColorText.jsx` | missing the three section headers |
| 157 | `src/for-both/files-and-notes/viewers/PhotoVideoViewer.jsx` | 2 cryptic names (bg@32, s@38); missing the three section headers |
| 157 | `src/for-both/whichProfileCardsToShow.js` | 1 cryptic names (n@71); missing the three section headers; export missing JSDoc @125,129,135 |
| 158 | `src/ai-coach/confirm-popups/sharedPopupParts.js` | missing the three section headers; export missing JSDoc @24,34,46 |
| 158 | `src/nutrition/food-search/SearchDisclaimerCard.jsx` | missing the three section headers |
| 159 | `src/for-both/payments/trainerPayoutSetup.js` | nesting 3+: postStripe depth 3 @81 |
| 159 | `src/workouts/create-plan/EditWorkoutPopup.jsx` | missing the three section headers |
| 160 | `src/for-both/trainer-listing/keepTrainerListingUpdated.js` | missing the three section headers |
| 165 | `src/for-both/online-connection/sendPhoneAlert.js` | nesting 3+: postRemotePushNotify depth 3 @106 |
| 165 | `src/look-and-feel/ColorText.jsx` | 1 cryptic names (v@19); missing the three section headers |
| 166 | `src/helpers/convertHeight.js` | missing the three section headers |
| 167 | `src/for-both/payments/HowPaymentsWorkSections.jsx` | missing the three section headers; export missing JSDoc @15,29,63 |
| 168 | `src/for-both/weekly-report/WeekPicker.jsx` | no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @8 |
| 168 | `src/trainer-app/documents/smartPaste.js` | missing the three section headers; export missing JSDoc @110; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 169 | `src/nutrition/food-cards/FoodListScreen.jsx` | 1 cryptic names (q@34); no plain opening (what / flow / who uses it); missing the three section headers |
| 170 | `src/daily-stats/saveDailyStats.js` | 1 cryptic names (h@96); missing the three section headers |
| 170 | `src/for-both/online-connection/uploadSetupAnswers.js` | nesting 3+: postWithAuth depth 3 @53 |
| 171 | `src/workouts/exercise-videos/ShortVideoCard.js` | 2 cryptic names (s@31, m@34); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 172 | `src/for-both/files-and-notes/viewers/PdfViewer.js` | 2 cryptic names (bg@19, s@30); missing the three section headers |
| 172 | `src/logout-cleanup/clearDataOnLogout.js` | nesting 3+: clearAllUserData depth 3 @31; clearUserSpecificData depth 3 @86; missing the three section headers |
| 172 | `src/nutrition/daily-log/MealCard.js` | missing the three section headers |
| 174 | `src/trainer-app/trainee-records/getTraineeDisplayName.js` | 5 cryptic names (t@32, t@42, t@50, r@80); missing the three section headers |
| 175 | `src/trainer-app/documents/spreadsheet-grid/SlideUpMenu.jsx` | missing the three section headers |
| 176 | `src/block-and-report/BlockedUsersScreen.jsx` | missing the three section headers |
| 177 | `src/workouts/create-plan/countPlansCreated.js` | 1 cryptic names (d@30); nesting 3+: mergeWorkoutGenerationUsage depth 3 @66; missing the three section headers; export missing JSDoc @19,23,28 |
| 181 | `src/ai-coach/conversation/ConfirmActionPopup.jsx` | missing the three section headers |
| 183 | `src/for-both/popups/ErrorPopup.jsx` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 184 | `src/workouts/exercise-videos/ExerciseCard.js` | missing the three section headers |
| 185 | `src/nutrition/food-search/cleanSearchText.js` | 3 cryptic names (n@27, d@58, n@83); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 186 | `src/trainer-app/documents/spreadsheet-grid/saveAndLoadSheet.js` | 4 cryptic names (r@91, c@94, r@145, c@147); nesting 3+: cellToLegacyFormat depth 4 @51; firestoreToSheets depth 3 @71; missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 187 | `src/for-both/setup-steps/setupStepPieces.jsx` | 1 cryptic names (bg@51); missing the three section headers; export missing JSDoc @77,117 |
| 189 | `src/for-both/loading-and-header/TopHeader.js` | missing the three section headers |
| 191 | `src/login-and-signup/SetupPreviewScreen.jsx` | missing the three section headers |
| 191 | `src/nutrition/food-cards/foodCardColors.js` | 4 cryptic names (h@58, r@60, g@61, b@62); missing the three section headers |
| 193 | `src/login-and-signup/finishSetup.js` | nesting 3+: completeOnboardingClient depth 4 @63; long and nested: completeOnboardingClient 130 lines @63; missing the three section headers |
| 193 | `src/login-and-signup/resetPasswordByEmail.js` | 1 cryptic names (s@23); nesting 3+: resetPasswordByEmail depth 3 @111; long and nested: resetPasswordByEmail 82 lines @111; missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 193 | `src/workouts/create-plan/GenerateMyWorkoutPlanScreen.jsx` | 1 cryptic names (bg@76); nesting 3+: anonymous depth 3 @139; missing the three section headers |
| 194 | `src/look-and-feel/colorPalette.js` | 14 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 195 | `src/ai-coach/past-chats/makeChatTitle.js` | nesting 3+: requestTitleFromDedicatedRoute depth 3 @109; requestTitleFromMainCoach depth 3 @133 |
| 196 | `src/workouts/view-plan/planViewPieces.jsx` | missing the three section headers |
| 197 | `src/client-app/home/keepDailyStatsFresh.js` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 205 | `src/workouts/exercise-videos/loadSavedWorkoutPlans.js` | 1 cryptic names (m@32); nesting 3+: fetchClientWorkoutPlansForLibrary depth 4 @109; long and nested: fetchClientWorkoutPlansForLibrary 96 lines @109; missing the three section headers; export missing JSDoc @109 |
| 207 | `src/app-start/cloudConnection.js` | missing the three section headers |
| 210 | `src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js` | 2 cryptic names (t@40, t@204); missing the three section headers |
| 212 | `src/workouts/view-plan/PlanPdfViewer.js` | nesting 3+: handleSaveToFiles depth 4 @52; missing the three section headers |
| 214 | `src/client-app/files-and-notes/FileCard.jsx` | missing the three section headers; export missing JSDoc @27 |
| 216 | `src/ai-coach/conversation/choosePhoto.js` | nesting 3+: pickCoachPhotosFromLibrary depth 3 @130 |
| 216 | `src/trainer-app/documents/EditorTopButtons.jsx` | missing the three section headers; export missing JSDoc @22,58,98 |
| 219 | `src/for-both/popups/HoldToConfirmPopup.jsx` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 219 | `src/trainer-app/scheduling/MonthCalendar.jsx` | 2 cryptic names (s@68, d@77); missing the three section headers; export missing JSDoc @40; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 220 | `src/for-both/setup-steps/AIPermissionStep.jsx` | 1 cryptic names (t@26); missing the three section headers; export missing JSDoc @19 |
| 222 | `src/ai-coach/past-chats/saveAndLoadChats.js` | missing the three section headers; export missing JSDoc @85,101,114 |
| 223 | `src/trainer-app/documents/pageStylePresets.js` | 1 cryptic names (bg@163); missing the three section headers; export missing JSDoc @92,156 |
| 224 | `src/trainer-app/documents/ShareDocumentPopup.js` | missing the three section headers |
| 225 | `src/client-app/find-a-trainer/TrainerCard.jsx` | 2 cryptic names (m@26, s@159); missing the three section headers |
| 225 | `src/nutrition/food-details/EditServingPopup.jsx` | 1 cryptic names (t@59); missing the three section headers |
| 227 | `src/trainer-app/documents/documentEditorTools.js` | missing the three section headers; export missing JSDoc @23,161,171 |
| 228 | `src/for-both/home-cards/FindTrainerBanner.jsx` | missing the three section headers |
| 229 | `src/client-app/find-a-trainer/RequestIntroPopup.jsx` | 1 cryptic names (bg@61); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 231 | `src/client-app/files-and-notes/NotesFromTrainerSection.jsx` | 1 cryptic names (n@22); missing the three section headers; export missing JSDoc @11 |
| 233 | `src/ai-coach/conversation/SourceLinkCards.jsx` | 1 cryptic names (m@30); missing the three section headers |
| 234 | `src/workouts/exercise-rows/ExerciseRow.jsx` | missing the three section headers; 6 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 236 | `src/nutrition/food-details/tidyBrandName.js` | 5 cryptic names (b@66, t@75, b@101, b@207); nesting 3+: resolveFoodBrandLabel depth 3 @181; missing the three section headers |
| 238 | `src/trainer-app/navigation/goToTrainerScreen.js` | missing the three section headers |
| 239 | `src/trainer-app/scheduling/WheelPicker.jsx` | missing the three section headers; export missing JSDoc @50 |
| 240 | `src/for-both/home-cards/QuickActionCard.jsx` | missing the three section headers |
| 240 | `src/nutrition/daily-log/DayPicker.jsx` | missing the three section headers |
| 242 | `src/ai-coach/reply-display/splitInternetAnswer.js` | nesting 3+: parseSectionBlocks depth 3 @200 |
| 244 | `src/trainer-app/scheduling/alertTraineeOfSession.js` | 5 cryptic names (h@29, m@31, d@48, t@81); missing the three section headers |
| 248 | `src/daily-stats/readDailyStats.js` | nesting 3+: buildWorkoutLogHydration depth 3 @211 |
| 255 | `src/client-app/files-and-notes/SharedByTrainerSection.jsx` | 1 cryptic names (t@56); missing the three section headers; export missing JSDoc @26 |
| 256 | `src/trainer-app/trainee-records/traineeDatabaseLocations.js` | missing the three section headers; export missing JSDoc @41,45,49 |
| 257 | `src/nutrition/food-details/fixPackageAmounts.js` | 14 cryptic names (s@27, n@31, m@36, v@38); nesting 3+: normalizeOpenFoodFactsProduct depth 3 @126; long and nested: normalizeOpenFoodFactsProduct 123 lines @126; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 258 | `src/settings/TermsOfServiceScreen.jsx` | 1 cryptic names (t@58); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 260 | `src/client-app/home/TopBannerCard.jsx` | missing the three section headers |
| 261 | `src/for-both/cloud-database/uploadAndDownloadFiles.js` | nesting 3+: listFiles depth 3 @169 |
| 263 | `src/for-both/online-connection/checkTrainerCertificate.js` | nesting 3+: checkTrainerCertificate depth 3 @212 |
| 266 | `src/login-and-signup/TrainerPayoutSetupStep.jsx` | missing the three section headers; export missing JSDoc @24 |
| 269 | `src/trainer-app/documents/spreadsheet-grid/SpreadsheetGrid.jsx` | no plain opening (what / flow / who uses it); missing the three section headers |
| 269 | `src/trainer-app/new-requests/NewTraineeRequestsScreen.jsx` | missing the three section headers |
| 271 | `src/trainer-app/scheduling/mySessions.js` | 4 cryptic names (s@37, d@38, s@55, q@97); missing the three section headers; export missing JSDoc @256,261,266; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 272 | `src/workouts/view-plan/WorkoutPlanView.jsx` | 1 cryptic names (n@63); long and nested: WorkoutPlanView 246 lines @26; no plain opening (what / flow / who uses it); missing the three section headers |
| 274 | `src/trainer-app/documents/spreadsheet-grid/SpreadsheetGridRow.jsx` | 1 cryptic names (d@95); missing the three section headers |
| 279 | `src/crash-reports/recordError.js` | nesting 3+: getDb depth 3 @65; writeErrorToMarkdownFile depth 3 @137 |
| 285 | `src/crash-reports/sendSavedErrors.js` | 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 287 | `src/client-app/home/WriteTrainerReviewPopup.js` | missing the three section headers |
| 293 | `src/for-both/home-cards/FilesHeaderCard.jsx` | missing the three section headers |
| 298 | `src/trainer-pro-plan/ProUpgradeOffer.jsx` | 1 cryptic names (t@53); no plain opening (what / flow / who uses it); missing the three section headers |
| 306 | `src/for-both/loading-and-header/BouncingDots.js` | missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 309 | `src/trainer-app/scheduling/SessionCard.jsx` | 1 cryptic names (d@44); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 310 | `src/client-app/find-a-trainer/BrowseTrainersScreen.jsx` | 2 cryptic names (t@100, s@210); missing the three section headers; export missing JSDoc @81 |
| 310 | `src/nutrition/food-search/restaurantMenuSearch.js` | 4 cryptic names (s@131, t@138, q@183, q@253); missing the three section headers |
| 310 | `src/nutrition/targets/recalculateFoodTargets.js` | 2 cryptic names (d@35, g@58); long and nested: recalibrateMacros 92 lines @175; missing the three section headers; 6 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 311 | `src/workouts/exercise-videos/DislikedExercisesPicker.jsx` | missing the three section headers; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 314 | `src/ai-coach/past-chats/loadOlderChats.js` | nesting 3+: boot depth 3 @283 |
| 319 | `src/workouts/view-plan/makePlanPdf.js` | 2 cryptic names (m@84, q@265); nesting 3+: parsePlanForPdf depth 4 @28; missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 326 | `src/ai-coach/past-chats/chatTitles.js` | nesting 3+: titleFromQuestionLead depth 3 @88; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 326 | `src/trainer-app/scheduling/CalendarTab.jsx` | 2 cryptic names (s@22, n@36); nesting 3+: parseQuery depth 3 @21; missing the three section headers; 6 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 329 | `src/trainer-app/navigation/trainerExtraScreens.jsx` | 14 cryptic names (s@41, s@58, s@95, s@100); missing the three section headers; export missing JSDoc @40,57,94 |
| 332 | `src/for-both/home-cards/DailyQuoteCard.js` | 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 337 | `src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx` | 2 cryptic names (n@33, r@50); missing the three section headers; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 339 | `src/trainer-app/documents/spreadsheet-grid/formulaCalculator.js` | 20 cryptic names (m@6, n@7, d@24, m@34); nesting 3+: evaluateCell depth 3 @54; anonymous depth 3 @142; no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @54 |
| 339 | `src/trainer-pro-plan/ProPlanPurchases.jsx` | nesting 3+: onPurchaseSuccess depth 3 @60; anonymous depth 4 @248; no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @45 |
| 340 | `src/for-both/weekly-report/WeeklyReportScreen.jsx` | 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 342 | `src/client-app/navigation/goToClientScreen.js` | missing the three section headers |
| 345 | `src/workouts/create-plan/WorkoutProfileTags.jsx` | nesting 3+: anonymous depth 3 @296; no plain opening (what / flow / who uses it); missing the three section headers |
| 347 | `src/settings/HelpFAQScreen.jsx` | 1 cryptic names (t@193); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 348 | `src/settings/PrivacyPolicyScreen.jsx` | 1 cryptic names (t@71); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 350 | `src/client-app/find-a-trainer/ConfirmRequestPopup.jsx` | 1 cryptic names (bg@74); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 360 | `src/ai-coach/coach-knowledge/loadWeeklyNumbers.js` | nesting 3+: fetchWorkoutAnalysis depth 3 @227; fetchSleepAnalysis depth 4 @277; 5 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 361 | `src/client-app/home/MyTrainerCard.jsx` | 2 cryptic names (t@52, a@53); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 368 | `src/settings/ContactSupportScreen.jsx` | 3 cryptic names (t@67, s@99, m@100); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 369 | `src/ai-coach/past-chats/savedChatShape.js` | nesting 3+: getAllChats depth 3 @118; saveChat depth 4 @171 |
| 382 | `src/settings/BugReportScreen.jsx` | 1 cryptic names (t@69); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 394 | `src/trainer-app/navigation/TrainerMainScreen.jsx` | 1 cryptic names (s@43); missing the three section headers |
| 398 | `src/nutrition/food-search/tidyFoodTitles.js` | 9 cryptic names (q@84, t@94, t@131, p@306); nesting 3+: cleanSerperFoodTitle depth 3 @121; missing the three section headers |
| 399 | `src/nutrition/food-search/knownRestaurantFoods.js` | 2 cryptic names (q@360, a@369); nesting 3+: lookupTrustedFoods depth 4 @359; missing the three section headers; 12 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 423 | `src/for-both/files-and-notes/viewers/SpreadsheetViewer.js` | 2 cryptic names (s@234, bg@265); nesting 3+: parseCSV depth 4 @58; missing the three section headers |
| 425 | `src/client-app/find-a-trainer/FindTrainerPieces.jsx` | 2 cryptic names (g@82, bg@156); missing the three section headers; export missing JSDoc @99,133,154; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 433 | `src/client-app/find-a-trainer/FilterPopup.js` | 2 cryptic names (t@92, s@322); missing the three section headers; export missing JSDoc @91 |
| 433 | `src/trainer-app/scheduling/BookSessionScreen.jsx` | missing the three section headers; export missing JSDoc @55; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 434 | `src/client-app/home/TodayStatsCards.jsx` | 5 cryptic names (R@80, g@88, p@90, c@92); missing the three section headers; export missing JSDoc @46; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 443 | `src/ai-coach/conversation/suggestedQuestions.js` | 3 cryptic names (s@172, s@201, s@346); missing the three section headers; export missing JSDoc @152,356,374; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 444 | `src/trainer-app/workout-plans/manualPlanToWorkoutPlan.js` | 6 cryptic names (s@46, m@49, n@51, n@74); missing the three section headers; export missing JSDoc @41,45,162; 10 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 447 | `src/ai-coach/coach-knowledge/loadYourWeekForCoach.js` | 4 cryptic names (n@35, c@48, u@89, g@221); nesting 3+: docInLast7Days depth 3 @45; fetchWeeklyContextFromServer depth 3 @168; long and nested: aggregateUserContext 113 lines @191; missing the three section headers; export missing JSDoc @432; 8 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 448 | `src/nutrition/food-cards/NutritionFactsPanel.jsx` | 1 cryptic names (v@154); no plain opening (what / flow / who uses it); missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 453 | `src/ai-coach/past-chats/PastChatsPanel.jsx` | 2 cryptic names (t@245, q@253); no plain opening (what / flow / who uses it); missing the three section headers |
| 453 | `src/client-app/files-and-notes/MyFilesSection.jsx` | 1 cryptic names (t@81); missing the three section headers; export missing JSDoc @58 |
| 456 | `src/for-both/app-wide-settings/AIPermission.js` | 9 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 457 | `src/client-app/find-a-trainer/TrainerProfilePopup.jsx` | 3 cryptic names (t@87, c@285, s@356); missing the three section headers; export missing JSDoc @68 |
| 459 | `src/client-app/find-a-trainer/SearchTrainersScreen.jsx` | 3 cryptic names (q@163, t@345, s@451); nesting 3+: anonymous depth 3 @64; missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 460 | `src/for-both/files-and-notes/viewers/FilesSection.jsx` | 2 cryptic names (n@105, s@381); missing the three section headers |
| 465 | `src/for-both/payments/PayoutSetupReminderPopup.jsx` | nesting 3+: anonymous depth 4 @62; missing the three section headers; export missing JSDoc @43 |
| 467 | `src/nutrition/food-search/combineFoodSources.js` | 3 cryptic names (c@43, q@50, s@288); nesting 3+: mapNutritionSearchToFoodRows depth 3 @297; missing the three section headers |
| 468 | `src/ai-coach/coach-actions/spotDeleteRequests.js` | nesting 3+: applyNutritionFoodName depth 3 @136; applyDeleteDate depth 3 @155; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 470 | `src/for-both/weekly-report/DayCard.jsx` | no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @141; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 475 | `src/nutrition/food-details/NutritionFactsScreen.jsx` | 2 cryptic names (t@56, s@392); no plain opening (what / flow / who uses it); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 475 | `src/trainer-app/scheduling/ScheduleSessionScreen.jsx` | 2 cryptic names (d@118, t@122); missing the three section headers; export missing JSDoc @68; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 476 | `src/trainer-app/home/TrainerListingPopup.js` | 3 cryptic names (d@36, t@86, p@268); nesting 3+: notifyClientRequestAccepted depth 3 @29; handleAddClient depth 4 @124; long and nested: handleAddClient 101 lines @124; missing the three section headers |
| 493 | `src/client-app/navigation/clientExtraScreens.jsx` | 18 cryptic names (s@81, s@117, s@136, s@141); missing the three section headers; export missing JSDoc @80,116,135 |
| 494 | `src/for-both/home-cards/HomeTopBanner.jsx` | 4 cryptic names (h@55, h@71, m@72, s@73); missing the three section headers; export missing JSDoc @40; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 506 | `src/ai-coach/conversation/sendMessageToCoach.js` | 1 cryptic names (m@38); nesting 3+: resetAiCoachDailyUsage depth 3 @73; postAICoach depth 5 @97; long and nested: postAICoach 125 lines @97; sendCoachMessage 172 lines @241; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 507 | `src/for-both/popups/RemoveTrainerPopup.js` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 507 | `src/nutrition/quick-add/QuickAddNutrition.jsx` | 1 cryptic names (t@40); missing the three section headers; export missing JSDoc @36 |
| 525 | `src/nutrition/food-cards/FoodCard.jsx` | 1 cryptic names (bg@52); no plain opening (what / flow / who uses it); missing the three section headers |
| 527 | `src/for-both/weekly-report/prepareReportForScreen.js` | 9 cryptic names (n@13, n@44, n@49, d@54); no plain opening (what / flow / who uses it); missing the three section headers; export missing JSDoc @404,463; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 531 | `src/client-app/files-and-notes/FilesScreen.jsx` | 3 cryptic names (bg@47, t@51, s@458); missing the three section headers |
| 532 | `src/app-start/LoginGate.js` | 2 cryptic names (r@392, r@472); nesting 3+: mergeLocalOnboardingTruth depth 4 @69; anonymous depth 6 @160; long and nested: LoginGate 430 lines @102; anonymous 183 lines @160; missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 532 | `src/nutrition/targets/NutritionSettingsScreen.js` | 3 cryptic names (n@97, f@180, s@329); missing the three section headers; 9 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 534 | `src/client-app/find-a-trainer/trainerFilters.js` | 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 538 | `src/trainer-app/my-trainees/MyTraineesScreen.jsx` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 560 | `src/workouts/create-plan/editPlanFieldForms.js` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 563 | `src/for-both/payments/PayTrainerPopup.jsx` | missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 584 | `src/ai-coach/CoachSelfTest.jsx` | 1 cryptic names (s@89); nesting 3+: runSingleTest depth 4 @140; no plain opening (what / flow / who uses it); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 591 | `src/nutrition/food-search/guessServingLabel.js` | 19 cryptic names (l@13, w@30, m@36, q@45); nesting 3+: extractServingLabelFromPageText depth 3 @382; long and nested: servingConflictsWithFood 89 lines @149; servingLabelFromQueryStructure 99 lines @281; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 595 | `src/trainer-app/trainee-detail/ManageTraineeScreen.jsx` | nesting 3+: anonymous depth 3 @130; long and nested: anonymous 95 lines @130; missing the three section headers; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 609 | `src/nutrition/food-details/nutritionFactsData.js` | 14 cryptic names (n@11, n@17, v@33, q@69); missing the three section headers; export missing JSDoc @110,186,345; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 609 | `src/trainer-app/weekly-report/WeeklyReportBanner.jsx` | 2 cryptic names (s@44, bg@57); missing the three section headers |
| 610 | `src/nutrition/food-search/trustRestaurantResult.js` | 18 cryptic names (q@113, t@124, q@130, m@177); nesting 3+: getMultiServingInfo depth 3 @174; variantPreferenceScore depth 3 @281; long and nested: variantPreferenceScore 122 lines @281; missing the three section headers; 6 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 615 | `src/trainer-app/progress-tab/TrainerProgressTab.jsx` | 2 cryptic names (n@159, w@499); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 627 | `src/messaging/InboxScreen.jsx` | 4 cryptic names (t@87, t@187, conv@258, c@576); nesting 3+: checkTrainerRole depth 3 @216; ensureClientConversation depth 3 @283; missing the three section headers; 8 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 639 | `src/for-both/files-and-notes/viewers/AddFilePopup.js` | 1 cryptic names (bg@349); nesting 3+: handleImportParse depth 4 @220; handleOptionPress depth 8 @375; long and nested: handleImportParse 96 lines @220; missing the three section headers |
| 677 | `src/navigation/BottomMenuBar.js` | missing the three section headers |
| 682 | `src/workouts/create-plan/saveAndLoadWorkoutPlan.js` | 8 cryptic names (q@149, q@242, q@270, q@394); nesting 3+: fetchWorkoutHistory depth 3 @386; getTodaysWorkouts depth 3 @468; missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 684 | `src/nutrition/daily-log/DailyLogContent.jsx` | 2 cryptic names (q@103, n@533); missing the three section headers; export missing JSDoc @46; 2 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 686 | `src/nutrition/food-search/rankFoodResults.js` | 17 cryptic names (q@121, t@139, m@140, n@142); nesting 3+: tokenHitsInHay depth 3 @146; scoreFoodSearchRelevance depth 4 @514; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 716 | `src/ai-coach/coach-actions/alertTrainer.js` | 7 cryptic names (t@43, r@87, q@529, d@602); nesting 3+: sendMessage depth 3 @157; sendAttachmentMessage depth 3 @234; long and nested: sendClientRequest 91 lines @303; missing the three section headers; export missing JSDoc @64,70,686 |
| 722 | `src/for-both/files-and-notes/viewers/FileGrid.jsx` | 6 cryptic names (s@145, c@195, n@217, t@227); nesting 3+: GalleryFileCard depth 5 @402; long and nested: GalleryFileCard 101 lines @402; missing the three section headers |
| 734 | `src/nutrition/targets/NutritionSetupScreen.jsx` | 1 cryptic names (T@73); missing the three section headers; export missing JSDoc @657; 5 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 764 | `src/nutrition/barcode/BarcodeScannerScreen.js` | 2 cryptic names (t@71, q@156); nesting 3+: lookupBarcode depth 3 @95; missing the three section headers |
| 773 | `src/client-app/navigation/ClientMainScreen.jsx` | 1 cryptic names (s@72); nesting 3+: anonymous depth 3 @274; missing the three section headers |
| 788 | `src/for-both/setup-steps/TrainerProOfferStep.jsx` | 2 cryptic names (t@267, t@381); long and nested: TrainerSubscriptionCtaFooter 100 lines @375; no plain opening (what / flow / who uses it); missing the three section headers |
| 791 | `src/for-both/files-and-notes/saveNotesAndFiles.js` | 2 cryptic names (u@67, d@401); nesting 3+: addFile depth 3 @217; missing the three section headers; export missing JSDoc @290,397,498; 6 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 800 | `src/nutrition/food-search/searchFoods.js` | 12 cryptic names (n@58, n@83, t@94, q@121); nesting 3+: searchOpenFoodFactsDirect depth 5 @220; anonymous depth 4 @333; long and nested: anonymous 135 lines @473; missing the three section headers; 12 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 859 | `src/for-both/photo-gallery/MyProgressPhotosScreen.jsx` | 2 cryptic names (q@313, t@422); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 863 | `src/ai-coach/coach-actions/carryOutAction.js` | 3 cryptic names (p@215, s@347, n@473); nesting 3+: executeToolViaServer depth 3 @135; carryOutAction depth 3 @698; long and nested: buildServerParams 131 lines @214; executeAdjustMacrosClient 87 lines @453; missing the three section headers; export missing JSDoc @65; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 910 | `src/trainer-app/home/trainerHomePieces.jsx` | 6 cryptic names (h@111, r@113, g@114, b@115); missing the three section headers |
| 922 | `src/nutrition/daily-log/saveLoggedFood.js` | 9 cryptic names (d@131, q@208, n@319, a@447); nesting 3+: anonymous depth 5 @236; addFoodLog depth 3 @292; long and nested: addFoodLog 115 lines @292; missing the three section headers; export missing JSDoc @143,170,200; 14 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 931 | `src/workouts/exercise-videos/findExerciseVideos.js` | 19 cryptic names (s@91, s@100, p@109, s@117); nesting 3+: extractKeywordsFromOnboarding depth 3 @398; fetchYoutubeItemsViaServer depth 3 @711; long and nested: extractKeywordsFromOnboarding 105 lines @398; missing the three section headers; 8 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 972 | `src/trainer-app/earnings/EarningsScreen.jsx` | 4 cryptic names (n@53, n@61, s@75, bg@110); missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 993 | `src/nutrition/food-search/FoodSearchScreen.js` | 4 cryptic names (u@126, c@233, q@585, q@609); missing the three section headers |
| 1030 | `src/workouts/create-plan/readPlanText.js` | 7 cryptic names (s@6, v@667, t@723, s@762); nesting 3+: normalizeStructuredPlanForViewer depth 3 @600; anonymous depth 3 @638; long and nested: normalizeStructuredPlanForViewer 81 lines @600; missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1032 | `src/messaging/ChatScreen.jsx` | 3 cryptic names (t@121, t@198, t@374); nesting 3+: checkTrainerRole depth 3 @461; initializeConversation depth 3 @485; missing the three section headers; 13 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1040 | `src/nutrition/daily-log/DailyFoodLogScreen.jsx` | 5 cryptic names (C@107, r@197, n@247, n@297); missing the three section headers; export missing JSDoc @729; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1043 | `src/trainer-app/documents/DocumentEditor.js` | 5 cryptic names (s@63, t@85, t@536, p@575); nesting 3+: anonymous depth 3 @560; missing the three section headers; 5 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1051 | `src/nutrition/food-search/ConfirmFoodPopup.jsx` | 5 cryptic names (n@76, t@121, g@149, t@150); nesting 3+: applyUnit depth 6 @330; missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1135 | `src/settings/SettingsScreen.js` | 4 cryptic names (n@64, bg@190, n@216, t@327); nesting 3+: anonymous depth 3 @309; handleReminderToggle depth 3 @409; missing the three section headers; 1 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1225 | `src/client-app/workout-plans/MyWorkoutPlanScreen.jsx` | 6 cryptic names (u@106, r@151, t@158, s@188); nesting 3+: parseRecoveryMeta depth 8 @686; missing the three section headers |
| 1244 | `src/client-app/meals/LogTodaysMealsScreen.jsx` | nesting 3+: loadUserProfile depth 4 @150; missing the three section headers; 4 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1334 | `src/for-both/workout-plans/SavedWorkoutsScreen.jsx` | 8 cryptic names (d@139, d@147, c@160, d@161); nesting 3+: deriveExerciseCount depth 3 @154; deriveMuscleTags depth 3 @172; missing the three section headers; 3 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1391 | `src/trainer-app/home/TrainerHomeContent.jsx` | 4 cryptic names (w@214, q@240, d@246, h@703); nesting 3+: anonymous depth 3 @409; long and nested: anonymous 98 lines @409; missing the three section headers; 6 inline rule-numbers (timeouts, status codes, or day/hour math) |
| 1488 | `src/client-app/home/homeScreenPieces.jsx` | 12 cryptic names (h@81, r@85, g@86, b@87); nesting 3+: TopStatsRow depth 3 @290; anonymous depth 4 @1030; long and nested: TopStatsRow 188 lines @290; missing the three section headers; 10 inline rule-numbers (timeouts, status codes, or day/hour math) |

## By folder

### `src/ai-coach` (1)

- `CoachSelfTest.jsx` (584 lines)

### `src/ai-coach/coach-actions` (4)

- `alertTrainer.js` (716 lines)
- `carryOutAction.js` (863 lines)
- `popupOrAutoRun.js` (138 lines)
- `spotDeleteRequests.js` (468 lines)

### `src/ai-coach/coach-knowledge` (3)

- `decideWhatCoachShouldKnow.js` (210 lines)
- `loadWeeklyNumbers.js` (360 lines)
- `loadYourWeekForCoach.js` (447 lines)

### `src/ai-coach/confirm-popups` (1)

- `sharedPopupParts.js` (158 lines)

### `src/ai-coach/conversation` (9)

- `ConfirmActionPopup.jsx` (181 lines)
- `PasteTextPopup.jsx` (116 lines)
- `SourceLinkCards.jsx` (233 lines)
- `choosePhoto.js` (216 lines)
- `copyReplyText.js` (108 lines)
- `photoPermissions.js` (105 lines)
- `preparePhotosToSend.js` (110 lines)
- `sendMessageToCoach.js` (506 lines)
- `suggestedQuestions.js` (443 lines)

### `src/ai-coach/past-chats` (7)

- `PastChatsPanel.jsx` (453 lines)
- `chatHistoryList.js` (110 lines)
- `chatTitles.js` (326 lines)
- `loadOlderChats.js` (314 lines)
- `makeChatTitle.js` (195 lines)
- `saveAndLoadChats.js` (222 lines)
- `savedChatShape.js` (369 lines)

### `src/ai-coach/reply-display` (1)

- `splitInternetAnswer.js` (242 lines)

### `src/app-start` (2)

- `LoginGate.js` (532 lines)
- `cloudConnection.js` (207 lines)

### `src/block-and-report` (1)

- `BlockedUsersScreen.jsx` (176 lines)

### `src/client-app/files-and-notes` (6)

- `FileCard.jsx` (214 lines)
- `FilesScreen.jsx` (531 lines)
- `MyFilesSection.jsx` (453 lines)
- `NotesFromTrainerSection.jsx` (231 lines)
- `SharedByTrainerSection.jsx` (255 lines)
- `TrainerSharedFilesPopup.jsx` (131 lines)

### `src/client-app/find-a-trainer` (11)

- `BrowseTrainersScreen.jsx` (310 lines)
- `ConfirmRequestPopup.jsx` (350 lines)
- `FilterPopup.js` (433 lines)
- `FindTrainerPieces.jsx` (425 lines)
- `FrostedPanel.jsx` (145 lines)
- `RequestIntroPopup.jsx` (229 lines)
- `SearchTrainersScreen.jsx` (459 lines)
- `TrainerCard.jsx` (225 lines)
- `TrainerProfilePopup.jsx` (457 lines)
- `sendConnectionRequest.js` (140 lines)
- `trainerFilters.js` (534 lines)

### `src/client-app/home` (6)

- `MyTrainerCard.jsx` (361 lines)
- `TodayStatsCards.jsx` (434 lines)
- `TopBannerCard.jsx` (260 lines)
- `WriteTrainerReviewPopup.js` (287 lines)
- `homeScreenPieces.jsx` (1488 lines)
- `keepDailyStatsFresh.js` (197 lines)

### `src/client-app/meals` (1)

- `LogTodaysMealsScreen.jsx` (1244 lines)

### `src/client-app/navigation` (4)

- `ClientMainScreen.jsx` (773 lines)
- `ClientScreenList.jsx` (102 lines)
- `clientExtraScreens.jsx` (493 lines)
- `goToClientScreen.js` (342 lines)

### `src/client-app/workout-plans` (1)

- `MyWorkoutPlanScreen.jsx` (1225 lines)

### `src/crash-reports` (2)

- `recordError.js` (279 lines)
- `sendSavedErrors.js` (285 lines)

### `src/daily-stats` (3)

- `readDailyStats.js` (248 lines)
- `saveDailyStats.js` (170 lines)
- `saveYesterdaysStats.js` (145 lines)

### `src/for-both` (1)

- `whichProfileCardsToShow.js` (157 lines)

### `src/for-both/app-wide-settings` (1)

- `AIPermission.js` (456 lines)

### `src/for-both/cloud-database` (1)

- `uploadAndDownloadFiles.js` (261 lines)

### `src/for-both/files-and-notes` (1)

- `saveNotesAndFiles.js` (791 lines)

### `src/for-both/files-and-notes/viewers` (6)

- `AddFilePopup.js` (639 lines)
- `FileGrid.jsx` (722 lines)
- `FilesSection.jsx` (460 lines)
- `PdfViewer.js` (172 lines)
- `PhotoVideoViewer.jsx` (157 lines)
- `SpreadsheetViewer.js` (423 lines)

### `src/for-both/home-cards` (5)

- `DailyQuoteCard.js` (332 lines)
- `FilesHeaderCard.jsx` (293 lines)
- `FindTrainerBanner.jsx` (228 lines)
- `HomeTopBanner.jsx` (494 lines)
- `QuickActionCard.jsx` (240 lines)

### `src/for-both/icons` (1)

- `OutlinedColorText.jsx` (156 lines)

### `src/for-both/loading-and-header` (3)

- `BouncingDots.js` (306 lines)
- `StartupLoadingCover.js` (119 lines)
- `TopHeader.js` (189 lines)

### `src/for-both/online-connection` (5)

- `checkConnectionHealth.js` (101 lines)
- `checkTrainerCertificate.js` (263 lines)
- `linkTrainerAndTrainee.js` (105 lines)
- `sendPhoneAlert.js` (165 lines)
- `uploadSetupAnswers.js` (170 lines)

### `src/for-both/payments` (7)

- `HowPaymentsWorkSections.jsx` (167 lines)
- `PayTrainerPopup.jsx` (563 lines)
- `PayoutSetupReminderPopup.jsx` (465 lines)
- `TrainerPayoutSetupPopup.jsx` (118 lines)
- `trainerPayoutSetup.js` (159 lines)
- `trainerPayoutSetupFlow.js` (134 lines)
- `whenToAskForPayoutSetup.js` (83 lines)

### `src/for-both/photo-gallery` (1)

- `MyProgressPhotosScreen.jsx` (859 lines)

### `src/for-both/popups` (3)

- `ErrorPopup.jsx` (183 lines)
- `HoldToConfirmPopup.jsx` (219 lines)
- `RemoveTrainerPopup.js` (507 lines)

### `src/for-both/setup-steps` (3)

- `AIPermissionStep.jsx` (220 lines)
- `TrainerProOfferStep.jsx` (788 lines)
- `setupStepPieces.jsx` (187 lines)

### `src/for-both/trainer-listing` (1)

- `keepTrainerListingUpdated.js` (160 lines)

### `src/for-both/weekly-report` (10)

- `ColorButton.jsx` (99 lines)
- `DayCard.jsx` (470 lines)
- `NoReportYet.jsx` (147 lines)
- `StatCard.jsx` (128 lines)
- `WeekPicker.jsx` (168 lines)
- `WeeklyReportScreen.jsx` (340 lines)
- `WinsAndWorkOnsSection.jsx` (113 lines)
- `loadWeekDailyEntries.js` (124 lines)
- `prepareReportForScreen.js` (527 lines)
- `writeTrainerTips.js` (150 lines)

### `src/for-both/workout-plans` (1)

- `SavedWorkoutsScreen.jsx` (1334 lines)

### `src/helpers` (3)

- `combineTraineeProfile.js` (90 lines)
- `convertHeight.js` (166 lines)
- `showSetupAnswers.js` (119 lines)

### `src/login-and-signup` (6)

- `SetupPreviewScreen.jsx` (191 lines)
- `TrainerPayoutSetupStep.jsx` (266 lines)
- `checkTrainerCode.js` (99 lines)
- `decideTraineeOrTrainer.js` (132 lines)
- `finishSetup.js` (193 lines)
- `resetPasswordByEmail.js` (193 lines)

### `src/logout-cleanup` (1)

- `clearDataOnLogout.js` (172 lines)

### `src/look-and-feel` (3)

- `ColorText.jsx` (165 lines)
- `GlassCard.jsx` (109 lines)
- `colorPalette.js` (194 lines)

### `src/messaging` (4)

- `ChatScreen.jsx` (1032 lines)
- `InboxScreen.jsx` (627 lines)
- `markMessagesRead.js` (97 lines)
- `unreadMessageCounts.js` (123 lines)

### `src/navigation` (2)

- `BottomMenuBar.js` (677 lines)
- `goToScreenByKeyword.js` (153 lines)

### `src/notifications` (1)

- `writeAlertText.js` (99 lines)

### `src/nutrition/barcode` (1)

- `BarcodeScannerScreen.js` (764 lines)

### `src/nutrition/daily-log` (6)

- `DailyFoodLogScreen.jsx` (1040 lines)
- `DailyLogContent.jsx` (684 lines)
- `DayPicker.jsx` (240 lines)
- `MacroBar.js` (98 lines)
- `MealCard.js` (172 lines)
- `saveLoggedFood.js` (922 lines)

### `src/nutrition/food-cards` (5)

- `FoodCard.jsx` (525 lines)
- `FoodListScreen.jsx` (169 lines)
- `NutritionFactsPanel.jsx` (448 lines)
- `foodCardColors.js` (191 lines)
- `foodCardText.js` (136 lines)

### `src/nutrition/food-details` (7)

- `EditServingPopup.jsx` (225 lines)
- `FoodItem.js` (154 lines)
- `NutritionFactsScreen.jsx` (475 lines)
- `fixPackageAmounts.js` (257 lines)
- `nutritionFactsData.js` (609 lines)
- `servingSizeMath.js` (155 lines)
- `tidyBrandName.js` (236 lines)

### `src/nutrition/food-search` (12)

- `ConfirmFoodPopup.jsx` (1051 lines)
- `FoodSearchScreen.js` (993 lines)
- `SearchDisclaimerCard.jsx` (158 lines)
- `cleanSearchText.js` (185 lines)
- `combineFoodSources.js` (467 lines)
- `guessServingLabel.js` (591 lines)
- `knownRestaurantFoods.js` (399 lines)
- `rankFoodResults.js` (686 lines)
- `restaurantMenuSearch.js` (310 lines)
- `searchFoods.js` (800 lines)
- `tidyFoodTitles.js` (398 lines)
- `trustRestaurantResult.js` (610 lines)

### `src/nutrition/quick-add` (1)

- `QuickAddNutrition.jsx` (507 lines)

### `src/nutrition/targets` (3)

- `NutritionSettingsScreen.js` (532 lines)
- `NutritionSetupScreen.jsx` (734 lines)
- `recalculateFoodTargets.js` (310 lines)

### `src/settings` (6)

- `BugReportScreen.jsx` (382 lines)
- `ContactSupportScreen.jsx` (368 lines)
- `HelpFAQScreen.jsx` (347 lines)
- `PrivacyPolicyScreen.jsx` (348 lines)
- `SettingsScreen.js` (1135 lines)
- `TermsOfServiceScreen.jsx` (258 lines)

### `src/trainer-app/documents` (10)

- `DocumentEditor.js` (1043 lines)
- `EditorTopButtons.jsx` (216 lines)
- `ShareDocumentPopup.js` (224 lines)
- `documentEditorTools.js` (227 lines)
- `editorAccent.jsx` (143 lines)
- `editorColors.js` (145 lines)
- `exportDocument.js` (119 lines)
- `pageStylePresets.js` (223 lines)
- `readingLevel.js` (131 lines)
- `smartPaste.js` (168 lines)

### `src/trainer-app/documents/spreadsheet-grid` (8)

- `FormulaBar.jsx` (146 lines)
- `SlideUpMenu.jsx` (175 lines)
- `SpreadsheetGrid.jsx` (269 lines)
- `SpreadsheetGridRow.jsx` (274 lines)
- `cellFormatting.js` (129 lines)
- `columnWidths.js` (139 lines)
- `formulaCalculator.js` (339 lines)
- `saveAndLoadSheet.js` (186 lines)

### `src/trainer-app/earnings` (1)

- `EarningsScreen.jsx` (972 lines)

### `src/trainer-app/home` (3)

- `TrainerHomeContent.jsx` (1391 lines)
- `TrainerListingPopup.js` (476 lines)
- `trainerHomePieces.jsx` (910 lines)

### `src/trainer-app/my-trainees` (2)

- `MyTraineesScreen.jsx` (538 lines)
- `pagedTraineeList.js` (136 lines)

### `src/trainer-app/navigation` (3)

- `TrainerMainScreen.jsx` (394 lines)
- `goToTrainerScreen.js` (238 lines)
- `trainerExtraScreens.jsx` (329 lines)

### `src/trainer-app/new-requests` (3)

- `NewTraineeRequestsScreen.jsx` (269 lines)
- `loadPendingTraineeRequests.js` (151 lines)
- `pendingRequestCount.js` (122 lines)

### `src/trainer-app/nutrition-tab` (1)

- `TrainerNutritionTab.jsx` (337 lines)

### `src/trainer-app/progress-tab` (2)

- `ProgressTopCard.jsx` (127 lines)
- `TrainerProgressTab.jsx` (615 lines)

### `src/trainer-app/scheduling` (9)

- `BookSessionScreen.jsx` (433 lines)
- `CalendarTab.jsx` (326 lines)
- `MonthCalendar.jsx` (219 lines)
- `ScheduleSessionScreen.jsx` (475 lines)
- `SessionCard.jsx` (309 lines)
- `SessionTimePicker.jsx` (129 lines)
- `WheelPicker.jsx` (239 lines)
- `alertTraineeOfSession.js` (244 lines)
- `mySessions.js` (271 lines)

### `src/trainer-app/trainee-detail` (1)

- `ManageTraineeScreen.jsx` (595 lines)

### `src/trainer-app/trainee-records` (3)

- `getTraineeDisplayName.js` (174 lines)
- `loadMyLinkedTrainees.js` (148 lines)
- `traineeDatabaseLocations.js` (256 lines)

### `src/trainer-app/weekly-report` (2)

- `TrainerWeeklyReportSection.jsx` (124 lines)
- `WeeklyReportBanner.jsx` (609 lines)

### `src/trainer-app/workout-plans` (2)

- `builtInExerciseList.js` (131 lines)
- `manualPlanToWorkoutPlan.js` (444 lines)

### `src/trainer-pro-plan` (3)

- `ProPlanPurchases.jsx` (339 lines)
- `ProUpgradeOffer.jsx` (298 lines)
- `proAccessRules.js` (128 lines)

### `src/workouts/create-plan` (9)

- `EditWorkoutPopup.jsx` (159 lines)
- `GenerateMyWorkoutPlanScreen.jsx` (193 lines)
- `WorkoutProfileTags.jsx` (345 lines)
- `askForWorkoutPlan.js` (131 lines)
- `countPlansCreated.js` (177 lines)
- `editPlanFieldForms.js` (560 lines)
- `readPlanText.js` (1030 lines)
- `saveAndLoadWorkoutPlan.js` (682 lines)
- `workoutPlanCreation.js` (111 lines)

### `src/workouts/exercise-rows` (1)

- `ExerciseRow.jsx` (234 lines)

### `src/workouts/exercise-videos` (6)

- `DislikedExercisesPicker.jsx` (311 lines)
- `ExerciseCard.js` (184 lines)
- `ShortVideoCard.js` (171 lines)
- `dislikableExercises.js` (123 lines)
- `findExerciseVideos.js` (931 lines)
- `loadSavedWorkoutPlans.js` (205 lines)

### `src/workouts/view-plan` (4)

- `PlanPdfViewer.js` (212 lines)
- `WorkoutPlanView.jsx` (272 lines)
- `makePlanPdf.js` (319 lines)
- `planViewPieces.jsx` (196 lines)
