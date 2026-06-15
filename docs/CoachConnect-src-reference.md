# CoachConnect — `src/` codebase documentation

**Project:** Coach Connect mobile app (Expo / React Native)  
**Scope:** Every `.js` / `.jsx` / `.ts` / `.tsx` file under `src/` (**251** files).  
**Non-code assets:** `.json` (Lottie, quotes), images — see [Appendix A](#appendix-a-static-assets-json--images).

**Quick links:** [Navigation map](#navigation-map-quick-links) · [Per-file TOC](#table-of-contents-all-files) · [Folder summaries](#summary-by-top-level-folder)

---

## <span id="navigation-map-quick-links"></span>Navigation map (quick links)

| Entry / file | Role |
|--------------|------|
| [`src/app/AuthGate.js`](#file-src-app-authgate-js) | Chooses client vs trainer shell after Firebase auth; onboarding gate. |
| [`src/app/ClientApp.js`](#file-src-app-clientapp-js) | Client role: tabs, dashboard, nutrition, workouts, trainer search, messaging. |
| [`src/app/TrainerApp.js`](#file-src-app-trainerapp-js) | Trainer role: CRM, clients, sessions, messaging, documents, AI tools. |
| [`src/navigation/BottomNavBar.js`](#file-src-navigation-bottomnavbar-js) | Shared bottom tab bar used by both apps. |
| [`src/navigation/AppNavigationContext.js`](#file-src-navigation-appnavigationcontext-js) | Navigation context / provider for nested flows. |
| [`src/navigation/CustomNavigationBar.jsx`](#file-src-navigation-customnavigationbar-jsx) | Optional custom top/navigation chrome. |

---

## How to read this doc

- **Table of contents** lists every file with a jump link.
- **Summary tables** group files by top-level folder for a quick scan.
- **Per-file sections** follow the 7-point template you requested.
- **Imported by** is derived from relative `import … from './…'` resolution inside `src/` only (aliases like `@/` may be missing).

---

## <span id="table-of-contents-all-files"></span>Table of contents (all files)

- [`src/ai/components/ApiKeyInput.js`](#file-src-ai-components-apikeyinput-js)
- [`src/ai/components/useChat.js`](#file-src-ai-components-usechat-js)
- [`src/ai/screens/AssignWorkoutScreen.js`](#file-src-ai-screens-assignworkoutscreen-js)
- [`src/ai/screens/ChatListScreen.js`](#file-src-ai-screens-chatlistscreen-js)
- [`src/ai/screens/ChatScreen.js`](#file-src-ai-screens-chatscreen-js)
- [`src/ai/screens/ClientDetailScreen.js`](#file-src-ai-screens-clientdetailscreen-js)
- [`src/ai/screens/ClientManagementScreen.js`](#file-src-ai-screens-clientmanagementscreen-js)
- [`src/ai/screens/ConversationSettingsScreen.js`](#file-src-ai-screens-conversationsettingsscreen-js)
- [`src/ai/screens/TrainerProfileScreen.jsx`](#file-src-ai-screens-trainerprofilescreen-jsx)
- [`src/ai/screens/TrainerSearchScreen.js`](#file-src-ai-screens-trainersearchscreen-js)
- [`src/ai/services/apiKeyService.js`](#file-src-ai-services-apikeyservice-js)
- [`src/ai/services/askServer.js`](#file-src-ai-services-askserver-js)
- [`src/ai/services/chatService.js`](#file-src-ai-services-chatservice-js)
- [`src/ai/services/chatStorageService.js`](#file-src-ai-services-chatstorageservice-js)
- [`src/ai/services/claudeClient.js`](#file-src-ai-services-claudeclient-js)
- [`src/ai/services/conversationService.js`](#file-src-ai-services-conversationservice-js)
- [`src/ai/services/imageService.js`](#file-src-ai-services-imageservice-js)
- [`src/ai/services/markAllMessagesRead.js`](#file-src-ai-services-markallmessagesread-js)
- [`src/ai/services/openaiClient.js`](#file-src-ai-services-openaiclient-js)
- [`src/ai/services/prompts.js`](#file-src-ai-services-prompts-js)
- [`src/ai/services/trainerMessaging.js`](#file-src-ai-services-trainermessaging-js)
- [`src/ai/services/webSearch.js`](#file-src-ai-services-websearch-js)
- [`src/aiChat/components/MiniOrb.jsx`](#file-src-aichat-components-miniorb-jsx)
- [`src/aiChat/screens/AIChatHomeScreen.jsx`](#file-src-aichat-screens-aichathomescreen-jsx)
- [`src/aiChat/screens/AIChatScreen.jsx`](#file-src-aichat-screens-aichatscreen-jsx)
- [`src/aiChat/screens/VoiceAIChatScreen.jsx`](#file-src-aichat-screens-voiceaichatscreen-jsx)
- [`src/aiChat/screens/VoiceAIHomeScreen.jsx`](#file-src-aichat-screens-voiceaihomescreen-jsx)
- [`src/app/AuthGate.js`](#file-src-app-authgate-js)
- [`src/app/calculations.js`](#file-src-app-calculations-js)
- [`src/app/ClientApp.js`](#file-src-app-clientapp-js)
- [`src/app/config.js`](#file-src-app-config-js)
- [`src/app/dateKey.js`](#file-src-app-datekey-js)
- [`src/app/permissions.js`](#file-src-app-permissions-js)
- [`src/app/RoleMigrationScreen.js`](#file-src-app-rolemigrationscreen-js)
- [`src/app/TrainerApp.js`](#file-src-app-trainerapp-js)
- [`src/auth/AuthScreen.js`](#file-src-auth-authscreen-js)
- [`src/auth/ForgotPasswordScreen.js`](#file-src-auth-forgotpasswordscreen-js)
- [`src/auth/OnboardingScreen.js`](#file-src-auth-onboardingscreen-js)
- [`src/client/components/DashboardHeroCard.jsx`](#file-src-client-components-dashboardherocard-jsx)
- [`src/client/components/files/FileCard.jsx`](#file-src-client-components-files-filecard-jsx)
- [`src/client/components/files/MyFilesSection.jsx`](#file-src-client-components-files-myfilessection-jsx)
- [`src/client/components/files/NotesFromTrainerSection.jsx`](#file-src-client-components-files-notesfromtrainersection-jsx)
- [`src/client/components/files/TrainerSharedSection.jsx`](#file-src-client-components-files-trainersharedsection-jsx)
- [`src/client/components/MarketplaceHeroCard.jsx`](#file-src-client-components-marketplaceherocard-jsx)
- [`src/client/components/PremiumStatsSection.jsx`](#file-src-client-components-premiumstatssection-jsx)
- [`src/client/components/PremiumTrainerCard.jsx`](#file-src-client-components-premiumtrainercard-jsx)
- [`src/client/components/PremiumWelcomeCard.jsx`](#file-src-client-components-premiumwelcomecard-jsx)
- [`src/client/components/TrainerProfileCardModal.jsx`](#file-src-client-components-trainerprofilecardmodal-jsx)
- [`src/client/components/WeeklyReportHeroCard.jsx`](#file-src-client-components-weeklyreportherocard-jsx)
- [`src/client/screens/AccountProfileScreen.jsx`](#file-src-client-screens-accountprofilescreen-jsx)
- [`src/client/screens/ClientFilesScreen.jsx`](#file-src-client-screens-clientfilesscreen-jsx)
- [`src/client/screens/DashboardScreen.js`](#file-src-client-screens-dashboardscreen-js)
- [`src/client/screens/DataStorageScreen.jsx`](#file-src-client-screens-datastoragescreen-jsx)
- [`src/client/screens/GoalsTargetsScreen.jsx`](#file-src-client-screens-goalstargetsscreen-jsx)
- [`src/client/screens/MyDashboardScreen.jsx`](#file-src-client-screens-mydashboardscreen-jsx)
- [`src/client/screens/NotificationsSettingsScreen.jsx`](#file-src-client-screens-notificationssettingsscreen-jsx)
- [`src/client/screens/PrivacySecurityScreen.jsx`](#file-src-client-screens-privacysecurityscreen-jsx)
- [`src/client/screens/ProfileScreen.js`](#file-src-client-screens-profilescreen-js)
- [`src/client/screens/ProgressAnalyticsScreen.js`](#file-src-client-screens-progressanalyticsscreen-js)
- [`src/client/screens/SettingsScreen.js`](#file-src-client-screens-settingsscreen-js)
- [`src/client/screens/SocialSharingScreen.jsx`](#file-src-client-screens-socialsharingscreen-jsx)
- [`src/client/screens/UnitsMeasurementsScreen.jsx`](#file-src-client-screens-unitsmeasurementsscreen-jsx)
- [`src/components/ErrorModal.jsx`](#file-src-components-errormodal-jsx)
- [`src/components/MonthCalendar.jsx`](#file-src-components-monthcalendar-jsx)
- [`src/components/SessionCalendar.jsx`](#file-src-components-sessioncalendar-jsx)
- [`src/components/SessionCard.jsx`](#file-src-components-sessioncard-jsx)
- [`src/components/WheelPicker.jsx`](#file-src-components-wheelpicker-jsx)
- [`src/contexts/AIContext.js`](#file-src-contexts-aicontext-js)
- [`src/hooks/use-sessions.js`](#file-src-hooks-use-sessions-js)
- [`src/lib/sessions.js`](#file-src-lib-sessions-js)
- [`src/Loader.js`](#file-src-loader-js)
- [`src/marketplace/components/TrainerRequestConfirmModal.jsx`](#file-src-marketplace-components-trainerrequestconfirmmodal-jsx)
- [`src/marketplace/components/TrainerRequestIntroModal.jsx`](#file-src-marketplace-components-trainerrequestintromodal-jsx)
- [`src/navigation/AppNavigationContext.js`](#file-src-navigation-appnavigationcontext-js)
- [`src/navigation/BottomNavBar.js`](#file-src-navigation-bottomnavbar-js)
- [`src/navigation/CustomNavigationBar.jsx`](#file-src-navigation-customnavigationbar-jsx)
- [`src/nutrition/components/EditServingModal.jsx`](#file-src-nutrition-components-editservingmodal-jsx)
- [`src/nutrition/components/FoodItem.js`](#file-src-nutrition-components-fooditem-js)
- [`src/nutrition/components/GradientFieldFrame.jsx`](#file-src-nutrition-components-gradientfieldframe-jsx)
- [`src/nutrition/components/MacroBar.js`](#file-src-nutrition-components-macrobar-js)
- [`src/nutrition/components/MealCard.js`](#file-src-nutrition-components-mealcard-js)
- [`src/nutrition/screens/BarcodeScannerScreen.js`](#file-src-nutrition-screens-barcodescannerscreen-js)
- [`src/nutrition/screens/FoodSearchScreen.js`](#file-src-nutrition-screens-foodsearchscreen-js)
- [`src/nutrition/screens/MacroTrackerScreen.js`](#file-src-nutrition-screens-macrotrackerscreen-js)
- [`src/nutrition/screens/MealPlanHomeScreen.js`](#file-src-nutrition-screens-mealplanhomescreen-js)
- [`src/nutrition/screens/NutritionContainer.jsx`](#file-src-nutrition-screens-nutritioncontainer-jsx)
- [`src/nutrition/screens/NutritionOnboardingScreen.jsx`](#file-src-nutrition-screens-nutritiononboardingscreen-jsx)
- [`src/nutrition/screens/NutritionScreen.jsx`](#file-src-nutrition-screens-nutritionscreen-jsx)
- [`src/nutrition/screens/NutritionSettingsScreen.js`](#file-src-nutrition-screens-nutritionsettingsscreen-js)
- [`src/nutrition/screens/QuickAddNutrition.jsx`](#file-src-nutrition-screens-quickaddnutrition-jsx)
- [`src/nutrition/screens/QuickAddScreen.jsx`](#file-src-nutrition-screens-quickaddscreen-jsx)
- [`src/nutrition/services/foodSearchProvider.js`](#file-src-nutrition-services-foodsearchprovider-js)
- [`src/nutrition/daily-log/logFoodToFirestore.js`](#file-src-nutrition-services-nutritionservice-js)
- [`src/nutrition/utils/nutritionNormalization.js`](#file-src-nutrition-utils-nutritionnormalization-js)
- [`src/profile/screens/ProfileScreen.jsx`](#file-src-profile-screens-profilescreen-jsx)
- [`src/screens/PlanViewerScreen.jsx`](#file-src-screens-planviewerscreen-jsx)
- [`src/screens/settings/ForgotPassword.js`](#file-src-screens-settings-forgotpassword-js)
- [`src/screens/settings/shared/useSettingsChrome.js`](#file-src-screens-settings-shared-usesettingschrome-js)
- [`src/settings/screens/AboutAppScreen.jsx`](#file-src-settings-screens-aboutappscreen-jsx)
- [`src/settings/screens/BugReportScreen.jsx`](#file-src-settings-screens-bugreportscreen-jsx)
- [`src/settings/screens/ChangePasswordScreen.jsx`](#file-src-settings-screens-changepasswordscreen-jsx)
- [`src/settings/screens/ContactSupportScreen.jsx`](#file-src-settings-screens-contactsupportscreen-jsx)
- [`src/settings/screens/EditProfileScreen.jsx`](#file-src-settings-screens-editprofilescreen-jsx)
- [`src/settings/screens/EmailPreferencesScreen.jsx`](#file-src-settings-screens-emailpreferencesscreen-jsx)
- [`src/settings/screens/HelpFAQScreen.jsx`](#file-src-settings-screens-helpfaqscreen-jsx)
- [`src/settings/screens/NotificationsOverviewScreen.jsx`](#file-src-settings-screens-notificationsoverviewscreen-jsx)
- [`src/settings/screens/PrivacyPolicyScreen.jsx`](#file-src-settings-screens-privacypolicyscreen-jsx)
- [`src/settings/screens/RestTimerSettingsScreen.jsx`](#file-src-settings-screens-resttimersettingsscreen-jsx)
- [`src/settings/screens/TermsOfServiceScreen.jsx`](#file-src-settings-screens-termsofservicescreen-jsx)
- [`src/settings/screens/WorkoutRemindersSettingsScreen.jsx`](#file-src-settings-screens-workoutreminderssettingsscreen-jsx)
- [`src/settings/supportConfig.js`](#file-src-settings-supportconfig-js)
- [`src/shared/assets/onboardingIconRegistry.generated.js`](#file-src-shared-assets-onboardingiconregistry-generated-js)
- [`src/shared/assets/onboardingIconRegistry.js`](#file-src-shared-assets-onboardingiconregistry-js)
- [`src/shared/components/AddNotesFilesModal.js`](#file-src-shared-components-addnotesfilesmodal-js)
- [`src/shared/components/AppLoadingScreen.js`](#file-src-shared-components-apploadingscreen-js)
- [`src/shared/components/Avatar.js`](#file-src-shared-components-avatar-js)
- [`src/shared/components/Button.js`](#file-src-shared-components-button-js)
- [`src/shared/components/Card.js`](#file-src-shared-components-card-js)
- [`src/shared/components/CoachConnectHeader.js`](#file-src-shared-components-coachconnectheader-js)
- [`src/shared/components/CreateModal.js`](#file-src-shared-components-createmodal-js)
- [`src/shared/components/DailyQuoteCard.js`](#file-src-shared-components-dailyquotecard-js)
- [`src/shared/components/DocumentEditorModal.js`](#file-src-shared-components-documenteditormodal-js)
- [`src/shared/components/DocumentViewerModal.js`](#file-src-shared-components-documentviewermodal-js)
- [`src/shared/components/EmbedWebViewModal.jsx`](#file-src-shared-components-embedwebviewmodal-jsx)
- [`src/shared/components/FadeInUp.jsx`](#file-src-shared-components-fadeinup-jsx)
- [`src/shared/components/FileGalleryGrid.jsx`](#file-src-shared-components-filegallerygrid-jsx)
- [`src/shared/components/FilesNotesSectionPremium.jsx`](#file-src-shared-components-filesnotessectionpremium-jsx)
- [`src/shared/components/GradientChatBubblesIcon.jsx`](#file-src-shared-components-gradientchatbubblesicon-jsx)
- [`src/shared/components/GradientGeminiNavIcon.jsx`](#file-src-shared-components-gradientgemininavicon-jsx)
- [`src/shared/components/HoldToConfirmModal.jsx`](#file-src-shared-components-holdtoconfirmmodal-jsx)
- [`src/shared/components/Input.js`](#file-src-shared-components-input-js)
- [`src/shared/components/LoadingSpinner.js`](#file-src-shared-components-loadingspinner-js)
- [`src/shared/components/MediaViewerModal.jsx`](#file-src-shared-components-mediaviewermodal-jsx)
- [`src/shared/components/Modal.js`](#file-src-shared-components-modal-js)
- [`src/shared/components/NavIcon.js`](#file-src-shared-components-navicon-js)
- [`src/shared/components/onboarding/AIOptInStep.jsx`](#file-src-shared-components-onboarding-aioptinstep-jsx)
- [`src/shared/components/onboarding/GradientCard.jsx`](#file-src-shared-components-onboarding-gradientcard-jsx)
- [`src/shared/components/onboarding/onboardingAiDeps.jsx`](#file-src-shared-components-onboarding-onboardingaideps-jsx)
- [`src/shared/components/onboarding/OnboardingProgress.jsx`](#file-src-shared-components-onboarding-onboardingprogress-jsx)
- [`src/shared/components/PdfViewerModal.js`](#file-src-shared-components-pdfviewermodal-js)
- [`src/shared/components/ProgressChart.js`](#file-src-shared-components-progresschart-js)
- [`src/shared/components/RemoveTrainerSheet.js`](#file-src-shared-components-removetrainersheet-js)
- [`src/shared/components/ReviewSubmitSheet.js`](#file-src-shared-components-reviewsubmitsheet-js)
- [`src/shared/components/SessionMeetingCard.jsx`](#file-src-shared-components-sessionmeetingcard-jsx)
- [`src/shared/components/ShareDocumentModal.js`](#file-src-shared-components-sharedocumentmodal-js)
- [`src/shared/components/SpreadsheetEditorModal.js`](#file-src-shared-components-spreadsheeteditormodal-js)
- [`src/shared/components/SpreadsheetViewerModal.js`](#file-src-shared-components-spreadsheetviewermodal-js)
- [`src/shared/components/TrainerSharedFilesModal.jsx`](#file-src-shared-components-trainersharedfilesmodal-jsx)
- [`src/shared/components/WeeklyReportPremium.jsx`](#file-src-shared-components-weeklyreportpremium-jsx)
- [`src/shared/components/WeightChart.js`](#file-src-shared-components-weightchart-js)
- [`src/shared/hooks/useChat.js`](#file-src-shared-hooks-usechat-js)
- [`src/shared/hooks/useExercises.js`](#file-src-shared-hooks-useexercises-js)
- [`src/shared/icons/LucideLike.js`](#file-src-shared-icons-lucidelike-js)
- [`src/shared/notifications/pushCopy.js`](#file-src-shared-notifications-pushcopy-js)
- [`src/shared/notifications/stripNotificationEmoji.js`](#file-src-shared-notifications-stripnotificationemoji-js)
- [`src/shared/services/baseUrl.js`](#file-src-shared-services-baseurl-js)
- [`src/shared/services/notesAndFilesService.js`](#file-src-shared-services-notesandfilesservice-js)
- [`src/shared/services/notificationsService.js`](#file-src-shared-services-notificationsservice-js)
- [`src/shared/services/onboardingSync.js`](#file-src-shared-services-onboardingsync-js)
- [`src/shared/services/pushNotifyApi.js`](#file-src-shared-services-pushnotifyapi-js)
- [`src/shared/services/storage.js`](#file-src-shared-services-storage-js)
- [`src/shared/ui/BlurBackdropPlate.jsx`](#file-src-shared-ui-blurbackdropplate-jsx)
- [`src/shared/ui/brandGradients.js`](#file-src-shared-ui-brandgradients-js)
- [`src/shared/ui/FluidGlass.examples.jsx`](#file-src-shared-ui-fluidglass-examples-jsx)
- [`src/shared/ui/FluidGlass.jsx`](#file-src-shared-ui-fluidglass-jsx)
- [`src/shared/ui/ios18Theme.js`](#file-src-shared-ui-ios18theme-js)
- [`src/shared/ui/liquid/LiquidBackground.jsx`](#file-src-shared-ui-liquid-liquidbackground-jsx)
- [`src/shared/ui/liquid/LiquidBackgroundLight.jsx`](#file-src-shared-ui-liquid-liquidbackgroundlight-jsx)
- [`src/shared/ui/liquid/LiquidGlassCard.jsx`](#file-src-shared-ui-liquid-liquidglasscard-jsx)
- [`src/shared/ui/liquid/LiquidGradientButton.jsx`](#file-src-shared-ui-liquid-liquidgradientbutton-jsx)
- [`src/shared/ui/liquid/LiquidIconHalo.jsx`](#file-src-shared-ui-liquid-liquidiconhalo-jsx)
- [`src/shared/ui/liquid/liquidTokens.js`](#file-src-shared-ui-liquid-liquidtokens-js)
- [`src/shared/ui/theme.js`](#file-src-shared-ui-theme-js)
- [`src/shared/ui/ThemeContext.js`](#file-src-shared-ui-themecontext-js)
- [`src/shared/utils/fileFormatting.js`](#file-src-shared-utils-fileformatting-js)
- [`src/shared/utils/getLocalDay.js`](#file-src-shared-utils-localday-js)
- [`src/shared/utils/notesFileView.js`](#file-src-shared-utils-notesfileview-js)
- [`src/shared/utils/trainerProfileMedia.js`](#file-src-shared-utils-trainerprofilemedia-js)
- [`src/shared/utils/workoutDayLabels.js`](#file-src-shared-utils-workoutdaylabels-js)
- [`src/splash/SplashScreen.jsx`](#file-src-splash-splashscreen-jsx)
- [`src/tests/workoutGeneration.test.js`](#file-src-tests-workoutgeneration-test-js)
- [`src/theme/colors.js`](#file-src-theme-colors-js)
- [`src/trainer/components/AnatroxDashboard.jsx`](#file-src-trainer-components-anatroxdashboard-jsx)
- [`src/trainer/components/CalendarView.jsx`](#file-src-trainer-components-calendarview-jsx)
- [`src/trainer/components/ClientHeader.jsx`](#file-src-trainer-components-clientheader-jsx)
- [`src/trainer/components/HeaderSection.jsx`](#file-src-trainer-components-headersection-jsx)
- [`src/trainer/components/MessagesView.jsx`](#file-src-trainer-components-messagesview-jsx)
- [`src/trainer/components/NotesView.jsx`](#file-src-trainer-components-notesview-jsx)
- [`src/trainer/components/NutritionView.jsx`](#file-src-trainer-components-nutritionview-jsx)
- [`src/trainer/components/ProgressView.jsx`](#file-src-trainer-components-progressview-jsx)
- [`src/trainer/components/QuickActions.jsx`](#file-src-trainer-components-quickactions-jsx)
- [`src/trainer/components/StatsCards.jsx`](#file-src-trainer-components-statscards-jsx)
- [`src/trainer/components/StatsRow.jsx`](#file-src-trainer-components-statsrow-jsx)
- [`src/trainer/components/TabNavigation.jsx`](#file-src-trainer-components-tabnavigation-jsx)
- [`src/trainer/components/TrainerMarketplaceModal.js`](#file-src-trainer-components-trainermarketplacemodal-js)
- [`src/trainer/components/TrainerWeeklyReportSection.jsx`](#file-src-trainer-components-trainerweeklyreportsection-jsx)
- [`src/trainer/components/WeekCalendar.jsx`](#file-src-trainer-components-weekcalendar-jsx)
- [`src/trainer/components/WorkoutCard.jsx`](#file-src-trainer-components-workoutcard-jsx)
- [`src/trainer/data/manualExerciseLibrarySeed.js`](#file-src-trainer-data-manualexerciselibraryseed-js)
- [`src/trainer/hooks/useTrainerClients.js`](#file-src-trainer-hooks-usetrainerclients-js)
- [`src/trainer/hooks/useTrainerPendingRequests.js`](#file-src-trainer-hooks-usetrainerpendingrequests-js)
- [`src/trainer/crm/formatClientName.js`](#file-src-trainer-lib-trainerclientdisplayname-js)
- [`src/trainer/screens/AIWorkoutPlansScreen.js`](#file-src-trainer-screens-aiworkoutplansscreen-js)
- [`src/trainer/screens/ClientDetailScreen.js`](#file-src-trainer-screens-clientdetailscreen-js)
- [`src/trainer/screens/ClientRequestsScreen.js`](#file-src-trainer-screens-clientrequestsscreen-js)
- [`src/trainer/screens/ConversationsListScreen.js`](#file-src-trainer-screens-conversationslistscreen-js)
- [`src/trainer/screens/ManualWorkoutPlanBuilderScreen.jsx`](#file-src-trainer-screens-manualworkoutplanbuilderscreen-jsx)
- [`src/trainer/screens/PhotoGalleryScreen.js`](#file-src-trainer-screens-photogalleryscreen-js)
- [`src/trainer/screens/SessionFormScreen.jsx`](#file-src-trainer-screens-sessionformscreen-jsx)
- [`src/trainer/screens/SessionSchedulerScreen.jsx`](#file-src-trainer-screens-sessionschedulerscreen-jsx)
- [`src/trainer/screens/SessionSchedulingScreen.jsx`](#file-src-trainer-screens-sessionschedulingscreen-jsx)
- [`src/trainer/screens/TrainerMessagingScreen.js`](#file-src-trainer-screens-trainermessagingscreen-js)
- [`src/trainer/screens/TrainerSearchScreen.js`](#file-src-trainer-screens-trainersearchscreen-js)
- [`src/trainer/screens/TrainerWeeklyReportScreen.jsx`](#file-src-trainer-screens-trainerweeklyreportscreen-jsx)
- [`src/trainer/services/clientCRMService.js`](#file-src-trainer-services-clientcrmservice-js)
- [`src/trainer/services/manualWorkoutPlanService.js`](#file-src-trainer-services-manualworkoutplanservice-js)
- [`src/trainer/services/pushSessionNotification.js`](#file-src-trainer-services-pushsessionnotification-js)
- [`src/trainer/services/scheduleService.js`](#file-src-trainer-services-scheduleservice-js)
- [`src/trainer/services/trainerPendingRequestsService.js`](#file-src-trainer-services-trainerpendingrequestsservice-js)
- [`src/utils/autoLogError.js`](#file-src-utils-autologerror-js)
- [`src/utils/clearDataOnLogout.js`](#file-src-utils-datacachecleanup-js)
- [`src/utils/migrateTrainers.js`](#file-src-utils-migratetrainers-js)
- [`src/utils/restaurantNutrition.js`](#file-src-utils-restaurantnutrition-js)
- [`src/utils/xlsx.js`](#file-src-utils-xlsx-js)
- [`src/utils/xlsx.native.js`](#file-src-utils-xlsx-native-js)
- [`src/utils/xlsx.web.js`](#file-src-utils-xlsx-web-js)
- [`src/workouts/components/EditModalForm_RN.jsx`](#file-src-workouts-components-editmodalform-rn-jsx)
- [`src/workouts/components/ExerciseCard.js`](#file-src-workouts-components-exercisecard-js)
- [`src/workouts/components/ExerciseCard.jsx`](#file-src-workouts-components-exercisecard-jsx)
- [`src/workouts/components/ExerciseCarousel.jsx`](#file-src-workouts-components-exercisecarousel-jsx)
- [`src/workouts/components/ExerciseGrid.jsx`](#file-src-workouts-components-exercisegrid-jsx)
- [`src/workouts/components/ExerciseLibrarySection.jsx`](#file-src-workouts-components-exerciselibrarysection-jsx)
- [`src/workouts/components/ExerciseRow.jsx`](#file-src-workouts-components-exerciserow-jsx)
- [`src/workouts/components/ExerciseSection.js`](#file-src-workouts-components-exercisesection-js)
- [`src/workouts/components/LoadingOverlay.jsx`](#file-src-workouts-components-loadingoverlay-jsx)
- [`src/workouts/components/PlanLimitBanner.jsx`](#file-src-workouts-components-planlimitbanner-jsx)
- [`src/workouts/components/ShortsCard.js`](#file-src-workouts-components-shortscard-js)
- [`src/workouts/components/VideoPlayerModal.jsx`](#file-src-workouts-components-videoplayermodal-jsx)
- [`src/workouts/components/WorkoutDayCard.jsx`](#file-src-workouts-components-workoutdaycard-jsx)
- [`src/workouts/components/WorkoutExerciseLibraryTab.jsx`](#file-src-workouts-components-workoutexerciselibrarytab-jsx)
- [`src/workouts/components/WorkoutPlanPdfViewerModal.js`](#file-src-workouts-components-workoutplanpdfviewermodal-js)
- [`src/workouts/components/YouTubeDebugOverlay.jsx`](#file-src-workouts-components-youtubedebugoverlay-jsx)
- [`src/workouts/hooks/useYouTubeAPI.js`](#file-src-workouts-hooks-useyoutubeapi-js)
- [`src/workouts/screens/ActiveWorkoutScreen.jsx`](#file-src-workouts-screens-activeworkoutscreen-jsx)
- [`src/workouts/screens/workout.js`](#file-src-workouts-screens-workout-js)
- [`src/workouts/screens/WorkoutHistoryScreen.jsx`](#file-src-workouts-screens-workouthistoryscreen-jsx)
- [`src/workouts/screens/workoutPlanBuilderFieldEditBody.js`](#file-src-workouts-screens-workoutplanbuilderfieldeditbody-js)
- [`src/workouts/screens/WorkoutPlanGeneratorScreenUI.js`](#file-src-workouts-screens-workoutplangeneratorscreenui-js)
- [`src/workouts/services/claudeWorkoutService.js`](#file-src-workouts-services-claudeworkoutservice-js)
- [`src/workouts/services/workoutPlanPdfService.js`](#file-src-workouts-services-workoutplanpdfservice-js)
- [`src/workouts/services/workoutService.js`](#file-src-workouts-services-workoutservice-js)

---

## <span id="summary-by-top-level-folder"></span>Summary by top-level folder

### `src/Loader.js/` (1)

| File | One-line |
|------|----------|
| [Loader.js](#file-src-loader-js) | Create animated values for each dot |

### `src/ai/` (22)

| File | One-line |
|------|----------|
| [ApiKeyInput.js](#file-src-ai-components-apikeyinput-js) | Reusable UI: ApiKeyInput. |
| [useChat.js](#file-src-ai-components-usechat-js) | Custom hook for managing chat state and OpenAI interactions @param {string} chatId - Optional chat ID to load an existing chat @returns {object} Chat state and … |
| [AssignWorkoutScreen.js](#file-src-ai-screens-assignworkoutscreen-js) | Purpose: Screen for trainers to assign custom workouts to their clients |
| [ChatListScreen.js](#file-src-ai-screens-chatlistscreen-js) | Load chats from storage |
| [ChatScreen.js](#file-src-ai-screens-chatscreen-js) | Screen: ChatScreen. |
| [ClientDetailScreen.js](#file-src-ai-screens-clientdetailscreen-js) | Purpose: Detailed view of a specific client with their progress, workouts, and nutrition data |
| [ClientManagementScreen.js](#file-src-ai-screens-clientmanagementscreen-js) | Purpose: Main screen for trainers to view and manage all their clients |
| [ConversationSettingsScreen.js](#file-src-ai-screens-conversationsettingsscreen-js) | Purpose: Settings screen for individual conversation (mute, delete, block, etc |
| [TrainerProfileScreen.jsx](#file-src-ai-screens-trainerprofilescreen-jsx) | Screen: TrainerProfileScreen. |
| [TrainerSearchScreen.js](#file-src-ai-screens-trainersearchscreen-js) | No in-app review surface yet — hide ratings/reviews and related filters (Firestore may still have legacy/seeded values) |
| [apiKeyService.js](#file-src-ai-services-apikeyservice-js) | Load API key from AsyncStorage and configure OpenAI Also checks environment variables as fallback |
| [askServer.js](#file-src-ai-services-askserver-js) | Resolve backend URL |
| [chatService.js](#file-src-ai-services-chatservice-js) | Sanitize user input: remove special symbols (#, *, $, etc |
| [chatStorageService.js](#file-src-ai-services-chatstorageservice-js) | Chat structure: {   id: string (unique ID),   title: string (first message or "New Chat"),   messages: Array<{ role: 'user'\|'assistant', content: string, imageU… |
| [claudeClient.js](#file-src-ai-services-claudeclient-js) | Claude AI Client  Simple, modular Claude API client for workout generation… |
| [conversationService.js](#file-src-ai-services-conversationservice-js) | Subscribe to real-time conversation updates for a user @param {string} userId - The user's ID @param {Function} callback - Callback function to receive conversa… |
| [imageService.js](#file-src-ai-services-imageservice-js) | Request camera/media library permissions |
| [markAllMessagesRead.js](#file-src-ai-services-markallmessagesread-js) | Utility to mark all messages as read for a user |
| [openaiClient.js](#file-src-ai-services-openaiclient-js) | generateResponse Sends a user prompt to the GPT model and returns { text, raw }… |
| [prompts.js](#file-src-ai-services-prompts-js) | AI prompt templates for consistent responses |
| [trainerMessaging.js](#file-src-ai-services-trainermessaging-js) | Get or create a conversation between a client and trainer @param {string} clientId - The client's user ID @param {string} trainerId - The trainer's user ID @ret… |
| [webSearch.js](#file-src-ai-services-websearch-js) | Resolve backend URL for server-side web search |

### `src/aiChat/` (5)

| File | One-line |
|------|----------|
| [MiniOrb.jsx](#file-src-aichat-components-miniorb-jsx) | Reusable UI: MiniOrb. |
| [AIChatHomeScreen.jsx](#file-src-aichat-screens-aichathomescreen-jsx) | AIChatHomeScreen… |
| [AIChatScreen.jsx](#file-src-aichat-screens-aichatscreen-jsx) | AIChatScreen… |
| [VoiceAIChatScreen.jsx](#file-src-aichat-screens-voiceaichatscreen-jsx) | Screen: VoiceAIChatScreen. |
| [VoiceAIHomeScreen.jsx](#file-src-aichat-screens-voiceaihomescreen-jsx) | Screen: VoiceAIHomeScreen. |

### `src/app/` (8)

| File | One-line |
|------|----------|
| [AuthGate.js](#file-src-app-authgate-js) | AuthGate - Handles authentication state and routes to appropriate app  Responsibilities: - Shows splash screen initially - Handles auth flow (login, signup, for… |
| [calculations.js](#file-src-app-calculations-js) | BMR calculation using Mifflin-St Jeor equation |
| [ClientApp.js](#file-src-app-clientapp-js) | ClientApp - Client-specific application interface with integrated home screen  Responsibilities: - Client dashboard rendering - Client screen navigation and sta… |
| [config.js](#file-src-app-config-js) | Get Firebase config from environment variables |
| [dateKey.js](#file-src-app-datekey-js) | Daily log date key — resets every 24 hours at midnight America/New_York… |
| [permissions.js](#file-src-app-permissions-js) | Request camera permission |
| [RoleMigrationScreen.js](#file-src-app-rolemigrationscreen-js) | import { migrateUserRoles, setTrainersByEmail } from ' |
| [TrainerApp.js](#file-src-app-trainerapp-js) | TrainerApp… |

### `src/auth/` (3)

| File | One-line |
|------|----------|
| [AuthScreen.js](#file-src-auth-authscreen-js) | AuthScreen - Combined authentication screen  * Combines WelcomeScreen, RoleSelectionScreen, SignupScreen, and LoginScreen into a single file with internal state… |
| [ForgotPasswordScreen.js](#file-src-auth-forgotpasswordscreen-js) | Source module `ForgotPasswordScreen` under auth/. |
| [OnboardingScreen.js](#file-src-auth-onboardingscreen-js) | OnboardingScreen - Combined onboarding flow for clients and trainers  Handles all 6 onboarding steps for both client and trainer roles with Apple-style subtle g… |

### `src/client/` (24)

| File | One-line |
|------|----------|
| [DashboardHeroCard.jsx](#file-src-client-components-dashboardherocard-jsx) | Matches Aurora hero + Settings: dark pink → dark orange |
| [FileCard.jsx](#file-src-client-components-files-filecard-jsx) | Thumbnails: for images we can safely fall back to the full download URL |
| [MyFilesSection.jsx](#file-src-client-components-files-myfilessection-jsx) | Reusable UI: MyFilesSection. |
| [NotesFromTrainerSection.jsx](#file-src-client-components-files-notesfromtrainersection-jsx) | Reusable UI: NotesFromTrainerSection. |
| [TrainerSharedSection.jsx](#file-src-client-components-files-trainersharedsection-jsx) | Reusable UI: TrainerSharedSection. |
| [MarketplaceHeroCard.jsx](#file-src-client-components-marketplaceherocard-jsx) | Cohesive accent rim (pink → purple) |
| [PremiumStatsSection.jsx](#file-src-client-components-premiumstatssection-jsx) | Same palette as session meeting cards: cyan → purple → pink |
| [PremiumTrainerCard.jsx](#file-src-client-components-premiumtrainercard-jsx) | PremiumTrainerCard - Prominent, tappable trainer card with gradient avatar ring, badges, and CTA |
| [PremiumWelcomeCard.jsx](#file-src-client-components-premiumwelcomecard-jsx) | PremiumWelcomeCard - Glass card with mascot/illustration, personalized greeting, and one clear primary action |
| [TrainerProfileCardModal.jsx](#file-src-client-components-trainerprofilecardmodal-jsx) | Reusable UI: TrainerProfileCardModal. |
| [WeeklyReportHeroCard.jsx](#file-src-client-components-weeklyreportherocard-jsx) | Soft violet / blush rim (not harsh red) |
| [AccountProfileScreen.jsx](#file-src-client-screens-accountprofilescreen-jsx) | Screen: AccountProfileScreen. |
| [ClientFilesScreen.jsx](#file-src-client-screens-clientfilesscreen-jsx) | Screen: ClientFilesScreen. |
| [DashboardScreen.js](#file-src-client-screens-dashboardscreen-js) | Helper function to calculate calorie goal |
| [DataStorageScreen.jsx](#file-src-client-screens-datastoragescreen-jsx) | Screen: DataStorageScreen. |
| [GoalsTargetsScreen.jsx](#file-src-client-screens-goalstargetsscreen-jsx) | Screen: GoalsTargetsScreen. |
| [MyDashboardScreen.jsx](#file-src-client-screens-mydashboardscreen-jsx) | Hide trainer bios that look like keyboard mash / test strings (e |
| [NotificationsSettingsScreen.jsx](#file-src-client-screens-notificationssettingsscreen-jsx) | Screen: NotificationsSettingsScreen. |
| [PrivacySecurityScreen.jsx](#file-src-client-screens-privacysecurityscreen-jsx) | Screen: PrivacySecurityScreen. |
| [ProfileScreen.js](#file-src-client-screens-profilescreen-js) | --- Reusable Components --- |
| [ProgressAnalyticsScreen.js](#file-src-client-screens-progressanalyticsscreen-js) | Screen: ProgressAnalyticsScreen. |
| [SettingsScreen.js](#file-src-client-screens-settingsscreen-js) | Settings UI — dark pink → dark orange gradient (no purple) |
| [SocialSharingScreen.jsx](#file-src-client-screens-socialsharingscreen-jsx) | Screen: SocialSharingScreen. |
| [UnitsMeasurementsScreen.jsx](#file-src-client-screens-unitsmeasurementsscreen-jsx) | Screen: UnitsMeasurementsScreen. |

### `src/components/` (5)

| File | One-line |
|------|----------|
| [ErrorModal.jsx](#file-src-components-errormodal-jsx) | CoachConnect-styled error / alert modal (gradient rim, glass inner, optional retry) |
| [MonthCalendar.jsx](#file-src-components-monthcalendar-jsx) | Source module `MonthCalendar` under components/. |
| [SessionCalendar.jsx](#file-src-components-sessioncalendar-jsx) | Source module `SessionCalendar` under components/. |
| [SessionCard.jsx](#file-src-components-sessioncard-jsx) | Source module `SessionCard` under components/. |
| [WheelPicker.jsx](#file-src-components-wheelpicker-jsx) | Wheel row values — full white reads better on tinted glass than low-opacity #000 |

### `src/contexts/` (1)

| File | One-line |
|------|----------|
| [AIContext.js](#file-src-contexts-aicontext-js) | Canonical per-user AI toggle — survives AuthGate profile refresh; key avoids clearAllUserData() coachconnect_* wipe |

### `src/hooks/` (1)

| File | One-line |
|------|----------|
| [use-sessions.js](#file-src-hooks-use-sessions-js) | useSessions — Trainer-wide session scheduling (across all clients)… |

### `src/lib/` (1)

| File | One-line |
|------|----------|
| [sessions.js](#file-src-lib-sessions-js) | Source module `sessions` under lib/. |

### `src/marketplace/` (2)

| File | One-line |
|------|----------|
| [TrainerRequestConfirmModal.jsx](#file-src-marketplace-components-trainerrequestconfirmmodal-jsx) | Reusable UI: TrainerRequestConfirmModal. |
| [TrainerRequestIntroModal.jsx](#file-src-marketplace-components-trainerrequestintromodal-jsx) | Reusable UI: TrainerRequestIntroModal. |

### `src/navigation/` (3)

| File | One-line |
|------|----------|
| [AppNavigationContext.js](#file-src-navigation-appnavigationcontext-js) | AppNavigationContext - Centralized navigation for CoachConnect header and bottom nav  * Apps (ClientApp, TrainerApp) provide handlers via the provider… |
| [BottomNavBar.js](#file-src-navigation-bottomnavbar-js) | Logo-aligned vertical gradient for all tab icons (pink → purple → indigo) |
| [CustomNavigationBar.jsx](#file-src-navigation-customnavigationbar-jsx) | Animate the outline |

### `src/nutrition/` (18)

| File | One-line |
|------|----------|
| [EditServingModal.jsx](#file-src-nutrition-components-editservingmodal-jsx) | Slim “Edit serving” dialog for a food log — gradient accents, compact fields |
| [FoodItem.js](#file-src-nutrition-components-fooditem-js) | Calories from FatSecret are base calories per serving |
| [GradientFieldFrame.jsx](#file-src-nutrition-components-gradientfieldframe-jsx) | Soft violet→mauve→steel border (matches FoodSearchScreen, not harsh rainbow) |
| [MacroBar.js](#file-src-nutrition-components-macrobar-js) | Reusable UI: MacroBar. |
| [MealCard.js](#file-src-nutrition-components-mealcard-js) | Reusable UI: MealCard. |
| [BarcodeScannerScreen.js](#file-src-nutrition-screens-barcodescannerscreen-js) | Barcode viewfinder corners — dark pink / dark orange |
| [FoodSearchScreen.js](#file-src-nutrition-screens-foodsearchscreen-js) | COACHCONNECT — Food Search Screen (Full Rewrite)  * Search priority:   1… |
| [MacroTrackerScreen.js](#file-src-nutrition-screens-macrotrackerscreen-js) | Screen: MacroTrackerScreen. |
| [MealPlanHomeScreen.js](#file-src-nutrition-screens-mealplanhomescreen-js) | ICON GOES HERE — refresh debug indicator |
| [NutritionContainer.jsx](#file-src-nutrition-screens-nutritioncontainer-jsx) | Build a dedup key from food name + meal type + date |
| [NutritionOnboardingScreen.jsx](#file-src-nutrition-screens-nutritiononboardingscreen-jsx) | ANATROX — Nutrition Onboarding Screen Converted from Lovable web export (Nutrition_Onboarding… |
| [NutritionScreen.jsx](#file-src-nutrition-screens-nutritionscreen-jsx) | Meal card action row — matches vibrant macro / brand styling |
| [NutritionSettingsScreen.js](#file-src-nutrition-screens-nutritionsettingsscreen-js) | COACHCONNECT — Nutrition Settings Screen Edit daily goals (calories, protein, carbs, fat) and reset to onboarding |
| [QuickAddNutrition.jsx](#file-src-nutrition-screens-quickaddnutrition-jsx) | Screen: QuickAddNutrition. |
| [QuickAddScreen.jsx](#file-src-nutrition-screens-quickaddscreen-jsx) | Full-page Quick Add (manual food log) |
| [foodSearchProvider.js](#file-src-nutrition-services-foodsearchprovider-js) | Food Search Provider Single source of truth for all food search operations Integrates with server endpoints for secure API calls |
| [nutritionService.js](#file-src-nutrition-services-nutritionservice-js) | Auto-log the error |
| [nutritionNormalization.js](#file-src-nutrition-utils-nutritionnormalization-js) | Nutrition portion normalization for Open Food Facts and other sources… |

### `src/profile/` (1)

| File | One-line |
|------|----------|
| [ProfileScreen.jsx](#file-src-profile-screens-profilescreen-jsx) | Height in Firestore may be a number (inches), string, or legacy object shape… |

### `src/screens/` (3)

| File | One-line |
|------|----------|
| [PlanViewerScreen.jsx](#file-src-screens-planviewerscreen-jsx) | Normalize API `focusColor` (hex or palette key) to accent tokens |
| [ForgotPassword.js](#file-src-screens-settings-forgotpassword-js) | Source module `ForgotPassword` under screens/. |
| [useSettingsChrome.js](#file-src-screens-settings-shared-usesettingschrome-js) | CoachConnect settings surfaces: dark (#0A0A0F glass) or light (theme background + frosted cards) |

### `src/settings/` (13)

| File | One-line |
|------|----------|
| [AboutAppScreen.jsx](#file-src-settings-screens-aboutappscreen-jsx) | Screen: AboutAppScreen. |
| [BugReportScreen.jsx](#file-src-settings-screens-bugreportscreen-jsx) | Screen: BugReportScreen. |
| [ChangePasswordScreen.jsx](#file-src-settings-screens-changepasswordscreen-jsx) | Screen: ChangePasswordScreen. |
| [ContactSupportScreen.jsx](#file-src-settings-screens-contactsupportscreen-jsx) | Screen: ContactSupportScreen. |
| [EditProfileScreen.jsx](#file-src-settings-screens-editprofilescreen-jsx) | Screen: EditProfileScreen. |
| [EmailPreferencesScreen.jsx](#file-src-settings-screens-emailpreferencesscreen-jsx) | Screen: EmailPreferencesScreen. |
| [HelpFAQScreen.jsx](#file-src-settings-screens-helpfaqscreen-jsx) | Screen: HelpFAQScreen. |
| [NotificationsOverviewScreen.jsx](#file-src-settings-screens-notificationsoverviewscreen-jsx) | Screen: NotificationsOverviewScreen. |
| [PrivacyPolicyScreen.jsx](#file-src-settings-screens-privacypolicyscreen-jsx) | Screen: PrivacyPolicyScreen. |
| [RestTimerSettingsScreen.jsx](#file-src-settings-screens-resttimersettingsscreen-jsx) | Screen: RestTimerSettingsScreen. |
| [TermsOfServiceScreen.jsx](#file-src-settings-screens-termsofservicescreen-jsx) | Screen: TermsOfServiceScreen. |
| [WorkoutRemindersSettingsScreen.jsx](#file-src-settings-screens-workoutreminderssettingsscreen-jsx) | Screen: WorkoutRemindersSettingsScreen. |
| [supportConfig.js](#file-src-settings-supportconfig-js) | Source module `supportConfig` under settings/. |

### `src/shared/` (68)

| File | One-line |
|------|----------|
| [onboardingIconRegistry.generated.js](#file-src-shared-assets-onboardingiconregistry-generated-js) | AUTO-GENERATED (but checked in) |
| [onboardingIconRegistry.js](#file-src-shared-assets-onboardingiconregistry-js) | Manual aliases so app domain keys don't have to match filename keys |
| [AddNotesFilesModal.js](#file-src-shared-components-addnotesfilesmodal-js) | Modal triggered by the bottom nav plus button |
| [AppLoadingScreen.js](#file-src-shared-components-apploadingscreen-js) | AppLoadingScreen — shared full-screen loading for the entire app (client and trainer)… |
| [Avatar.js](#file-src-shared-components-avatar-js) | Reusable UI: Avatar. |
| [Button.js](#file-src-shared-components-button-js) | Button Component @param {string} title - Button text @param {function} onPress - Press handler @param {string} variant - 'primary' \| 'secondary' \| 'outline' @pa… |
| [Card.js](#file-src-shared-components-card-js) | Card Component @param {ReactNode} children - Card content @param {function} onPress - Press handler (optional) @param {object} style - Additional styles |
| [CoachConnectHeader.js](#file-src-shared-components-coachconnectheader-js) | Matches Settings screen pill gradient (dark pink → dark orange) |
| [CreateModal.js](#file-src-shared-components-createmodal-js) | Reusable UI: CreateModal. |
| [DailyQuoteCard.js](#file-src-shared-components-dailyquotecard-js) | Curated quotes from `dailyQuotesList |
| [DocumentEditorModal.js](#file-src-shared-components-documenteditormodal-js) | Trainer document editor — create or edit a document |
| [DocumentViewerModal.js](#file-src-shared-components-documentviewermodal-js) | Read-only in-app viewer for trainer-created documents |
| [EmbedWebViewModal.jsx](#file-src-shared-components-embedwebviewmodal-jsx) | Fullscreen embedded viewer (Office Online / Google gview) — keeps user in the app |
| [FadeInUp.jsx](#file-src-shared-components-fadeinup-jsx) | Tiny reusable entrance animation wrapper: fades in + lifts up a few px |
| [FileGalleryGrid.jsx](#file-src-shared-components-filegallerygrid-jsx) | Shared file gallery UI — gradient-bordered cards in a 2-column grid… |
| [FilesNotesSectionPremium.jsx](#file-src-shared-components-filesnotessectionpremium-jsx) | Reusable UI: FilesNotesSectionPremium. |
| [GradientChatBubblesIcon.jsx](#file-src-shared-components-gradientchatbubblesicon-jsx) | Chat bubbles masked with brand gradient (matches BottomNavBar / cg logo) |
| [GradientGeminiNavIcon.jsx](#file-src-shared-components-gradientgemininavicon-jsx) | Google Gemini mark — filled with the same brand gradient as other tab icons (`BrandGradientIcon`) |
| [HoldToConfirmModal.jsx](#file-src-shared-components-holdtoconfirmmodal-jsx) | Destructive confirmation: user must press and hold until the progress bar fills… |
| [Input.js](#file-src-shared-components-input-js) | Input Component @param {string} label - Label text above input @param {string} value - Input value @param {function} onChangeText - Text change handler @param {… |
| [LoadingSpinner.js](#file-src-shared-components-loadingspinner-js) | LoadingSpinner Component - Now uses dot jumping loader @param {string} text - Text to display below loader |
| [MediaViewerModal.jsx](#file-src-shared-components-mediaviewermodal-jsx) | Reusable UI: MediaViewerModal. |
| [Modal.js](#file-src-shared-components-modal-js) | Modal Component @param {boolean} visible - Modal visibility @param {function} onClose - Close handler @param {ReactNode} children - Modal content @param {string… |
| [NavIcon.js](#file-src-shared-components-navicon-js) | Reusable UI: NavIcon. |
| [AIOptInStep.jsx](#file-src-shared-components-onboarding-aioptinstep-jsx) | Reusable UI: AIOptInStep. |
| [GradientCard.jsx](#file-src-shared-components-onboarding-gradientcard-jsx) | Darken gradient colors by 10% when selected |
| [onboardingAiDeps.jsx](#file-src-shared-components-onboarding-onboardingaideps-jsx) | Shared onboarding tokens + primary CTA only |
| [OnboardingProgress.jsx](#file-src-shared-components-onboarding-onboardingprogress-jsx) | Reusable UI: OnboardingProgress. |
| [PdfViewerModal.js](#file-src-shared-components-pdfviewermodal-js) | Reusable UI: PdfViewerModal. |
| [ProgressChart.js](#file-src-shared-components-progresschart-js) | Progress Chart Component |
| [RemoveTrainerSheet.js](#file-src-shared-components-removetrainersheet-js) | Bottom sheet for removing trainer/client relationship |
| [ReviewSubmitSheet.js](#file-src-shared-components-reviewsubmitsheet-js) | Bottom sheet for submitting or editing a trainer review |
| [SessionMeetingCard.jsx](#file-src-shared-components-sessionmeetingcard-jsx) | Glass-style session card (matches PremiumWelcomeCard / app chrome — no rainbow frame)… |
| [ShareDocumentModal.js](#file-src-shared-components-sharedocumentmodal-js) | Share trainer document with clients |
| [SpreadsheetEditorModal.js](#file-src-shared-components-spreadsheeteditormodal-js) | Simple functions: SUM/AVG/COUNT/MIN/MAX over a range like A1:A10 |
| [SpreadsheetViewerModal.js](#file-src-shared-components-spreadsheetviewermodal-js) | In-app spreadsheet viewer for  |
| [TrainerSharedFilesModal.jsx](#file-src-shared-components-trainersharedfilesmodal-jsx) | Full-screen list of trainer-shared files (same grid chrome as home preview) |
| [WeeklyReportPremium.jsx](#file-src-shared-components-weeklyreportpremium-jsx) | Per-trend accent: sleep sky, water cyan, movement green, coaching purple |
| [WeightChart.js](#file-src-shared-components-weightchart-js) | Weight Chart Component |
| [useChat.js](#file-src-shared-hooks-usechat-js) | Custom hook for managing chat state and OpenAI interactions @param {string} chatId - Optional chat ID to load an existing chat @returns {object} Chat state and … |
| [useExercises.js](#file-src-shared-hooks-useexercises-js) | React hook useExercises for trainer/client data or UI behavior. |
| [LucideLike.js](#file-src-shared-icons-lucidelike-js) | Source module `LucideLike` under shared/. |
| [pushCopy.js](#file-src-shared-notifications-pushcopy-js) | detailLine e |
| [stripNotificationEmoji.js](#file-src-shared-notifications-stripnotificationemoji-js) | Remove emoji / pictographs from push notification title and body (client) |
| [baseUrl.js](#file-src-shared-services-baseurl-js) | In dev, Metro exposes the machine IP here |
| [notesAndFilesService.js](#file-src-shared-services-notesandfilesservice-js) | Notes & Files — client and trainer can add notes, photos, videos, PDFs… |
| [notificationsService.js](#file-src-shared-services-notificationsservice-js) | @type {((data: Record<string, unknown>) => void) \| null} |
| [onboardingSync.js](#file-src-shared-services-onboardingsync-js) | Queue a pending onboarding completion payload to sync later |
| [pushNotifyApi.js](#file-src-shared-services-pushnotifyapi-js) | Remote push via Express POST /api/notifications/send (Expo path on server) |
| [storage.js](#file-src-shared-services-storage-js) | Upload a file to Firebase Storage |
| [BlurBackdropPlate.jsx](#file-src-shared-ui-blurbackdropplate-jsx) | Use blur as a backdrop only… |
| [brandGradients.js](#file-src-shared-ui-brandgradients-js) | Brand gradient aligned with cg logo (pink → purple → indigo), top → bottom |
| [FluidGlass.examples.jsx](#file-src-shared-ui-fluidglass-examples-jsx) | FluidGlass Usage Examples  This file shows how to convert existing UI components to use FluidGlass |
| [FluidGlass.jsx](#file-src-shared-ui-fluidglass-jsx) | FluidGlass - True Liquid Glass Effect Component for React Native  Creates Apple iOS 26-style liquid glass effect using advanced styling Mimics refraction, light… |
| [ios18Theme.js](#file-src-shared-ui-ios18theme-js) | iOS 18 Design Language Theme |
| [LiquidBackground.jsx](#file-src-shared-ui-liquid-liquidbackground-jsx) | Deep obsidian base with 3 mesh-like radial blurs in the corners |
| [LiquidBackgroundLight.jsx](#file-src-shared-ui-liquid-liquidbackgroundlight-jsx) | Light-mode mesh background: soft paper base with subtle pastel corner blurs |
| [LiquidGlassCard.jsx](#file-src-shared-ui-liquid-liquidglasscard-jsx) | Custom "glass material": - background blur ~30 - semi-transparent surface - linear border brighter at top, fading to bottom - squircle geometry (continuous curv… |
| [LiquidGradientButton.jsx](#file-src-shared-ui-liquid-liquidgradientbutton-jsx) | Source module `LiquidGradientButton` under shared/. |
| [LiquidIconHalo.jsx](#file-src-shared-ui-liquid-liquidiconhalo-jsx) | Subtle glassmorphic halo behind an icon (quiet luxury): - no shadows - soft gradient + faint stroke - squircle geometry |
| [liquidTokens.js](#file-src-shared-ui-liquid-liquidtokens-js) | Accent palette (requested): hot pink, cyan, magenta, dark purple, light orange |
| [theme.js](#file-src-shared-ui-theme-js) | Theme configuration for React Native styling with Light and Dark mode support |
| [ThemeContext.js](#file-src-shared-ui-themecontext-js) | Load saved theme preference |
| [fileFormatting.js](#file-src-shared-utils-fileformatting-js) | UUID (8-4-4-4-12) or long hex-ish stems are usually not user-friendly |
| [localDay.js](#file-src-shared-utils-localday-js) | Local-day helpers (device timezone) |
| [notesFileView.js](#file-src-shared-utils-notesfileview-js) | Helpers for opening notes & files in-app (images, video, embeds) instead of Safari |
| [trainerProfileMedia.js](#file-src-shared-utils-trainerprofilemedia-js) | Resolve a usable profile image URL from trainer / user shapes used across the app… |
| [workoutDayLabels.js](#file-src-shared-utils-workoutdaylabels-js) | Allowed labels for "today's workout" / workout day on the client dashboard |

### `src/splash/` (1)

| File | One-line |
|------|----------|
| [SplashScreen.jsx](#file-src-splash-splashscreen-jsx) | Make title visible immediately |

### `src/tests/` (1)

| File | One-line |
|------|----------|
| [workoutGeneration.test.js](#file-src-tests-workoutgeneration-test-js) | Load  |

### `src/theme/` (1)

| File | One-line |
|------|----------|
| [colors.js](#file-src-theme-colors-js) | RN shadow tokens (web box-shadow equivalents) |

### `src/trainer/` (37)

| File | One-line |
|------|----------|
| [AnatroxDashboard.jsx](#file-src-trainer-components-anatroxdashboard-jsx) | Reusable UI: AnatroxDashboard. |
| [CalendarView.jsx](#file-src-trainer-components-calendarview-jsx) | Glass morphism effect |
| [ClientHeader.jsx](#file-src-trainer-components-clientheader-jsx) | Glass morphism effect |
| [HeaderSection.jsx](#file-src-trainer-components-headersection-jsx) | Reusable UI: HeaderSection. |
| [MessagesView.jsx](#file-src-trainer-components-messagesview-jsx) | Load clients from trainer_clients subcollection |
| [NotesView.jsx](#file-src-trainer-components-notesview-jsx) | Request permission first |
| [NutritionView.jsx](#file-src-trainer-components-nutritionview-jsx) | Fetch today's nutrition logs |
| [ProgressView.jsx](#file-src-trainer-components-progressview-jsx) | Fetch progress history - try both paths |
| [QuickActions.jsx](#file-src-trainer-components-quickactions-jsx) | Glass morphism effect |
| [StatsCards.jsx](#file-src-trainer-components-statscards-jsx) | Glass morphism effect |
| [StatsRow.jsx](#file-src-trainer-components-statsrow-jsx) | Reusable UI: StatsRow. |
| [TabNavigation.jsx](#file-src-trainer-components-tabnavigation-jsx) | Glass morphism effect |
| [TrainerMarketplaceModal.js](#file-src-trainer-components-trainermarketplacemodal-js) | Called after a successful reject (e |
| [TrainerWeeklyReportSection.jsx](#file-src-trainer-components-trainerweeklyreportsection-jsx) | Trainer dashboard: hero card under client chips → opens full weekly report for selected client |
| [WeekCalendar.jsx](#file-src-trainer-components-weekcalendar-jsx) | Reusable UI: WeekCalendar. |
| [WorkoutCard.jsx](#file-src-trainer-components-workoutcard-jsx) | Glass morphism effect |
| [manualExerciseLibrarySeed.js](#file-src-trainer-data-manualexerciselibraryseed-js) | Offline exercise library for the manual workout plan builder (search + autocomplete)… |
| [useTrainerClients.js](#file-src-trainer-hooks-usetrainerclients-js) | CRM row explicitly marked inactive (legacy / soft paths) |
| [useTrainerPendingRequests.js](#file-src-trainer-hooks-usetrainerpendingrequests-js) | Hook to fetch and refresh pending client requests for a trainer |
| [trainerClientDisplayName.js](#file-src-trainer-lib-trainerclientdisplayname-js) | Trainer roster: CRM `trainer_clients/… |
| [AIWorkoutPlansScreen.js](#file-src-trainer-screens-aiworkoutplansscreen-js) | Rules / index issues — show empty library, not raw Firestore text |
| [ClientDetailScreen.js](#file-src-trainer-screens-clientdetailscreen-js) | ClientDetailScreen is defined inline in src/app/TrainerApp |
| [ClientRequestsScreen.js](#file-src-trainer-screens-clientrequestsscreen-js) | Screen: ClientRequestsScreen. |
| [ConversationsListScreen.js](#file-src-trainer-screens-conversationslistscreen-js) | Conversations List Screen — new glass UI, existing Firebase and navigation… |
| [ManualWorkoutPlanBuilderScreen.jsx](#file-src-trainer-screens-manualworkoutplanbuilderscreen-jsx) | Screen: ManualWorkoutPlanBuilderScreen. |
| [PhotoGalleryScreen.js](#file-src-trainer-screens-photogalleryscreen-js) | Pinch + double-tap zoom |
| [SessionFormScreen.jsx](#file-src-trainer-screens-sessionformscreen-jsx) | Dark pink + dark orange wheel chrome (Date / Time on session form) |
| [SessionSchedulerScreen.jsx](#file-src-trainer-screens-sessionschedulerscreen-jsx) | SessionSchedulerScreen — Schedule tab for trainer client detail… |
| [SessionSchedulingScreen.jsx](#file-src-trainer-screens-sessionschedulingscreen-jsx) | Screen: SessionSchedulingScreen. |
| [TrainerMessagingScreen.js](#file-src-trainer-screens-trainermessagingscreen-js) | Trainer Messaging (Chat) Screen — new glass UI, existing Firebase and send flow |
| [TrainerSearchScreen.js](#file-src-trainer-screens-trainersearchscreen-js) | Re-exports TrainerSearchScreen from ai module for consistency |
| [TrainerWeeklyReportScreen.jsx](#file-src-trainer-screens-trainerweeklyreportscreen-jsx) | Same rim + checklist language as `MarketplaceHeroCard` (Find trainers) |
| [clientCRMService.js](#file-src-trainer-services-clientcrmservice-js) | Trainer client CRM — Firestore helpers… |
| [manualWorkoutPlanService.js](#file-src-trainer-services-manualworkoutplanservice-js) | Maps manual builder state → WorkoutPlanGeneratorScreen `structuredPlan |
| [pushSessionNotification.js](#file-src-trainer-services-pushsessionnotification-js) | Send a session-scheduled push to the client from the trainer app… |
| [scheduleService.js](#file-src-trainer-services-scheduleservice-js) | Session schedule — trainer_clients/{trainerId}_{clientId}/schedule/{blockId} Trainer: full CRUD |
| [trainerPendingRequestsService.js](#file-src-trainer-services-trainerpendingrequestsservice-js) | Service to fetch pending client requests for a trainer |

### `src/utils/` (7)

| File | One-line |
|------|----------|
| [autoLogError.js](#file-src-utils-autologerror-js) | Lightweight error logger used across the app… |
| [dataCacheCleanup.js](#file-src-utils-datacachecleanup-js) | Fix data leakage by clearing all cached data when user switches |
| [migrateTrainers.js](#file-src-utils-migratetrainers-js) | Migrates all users with role 'trainer' to the trainers collection This should be run once to migrate existing trainer accounts |
| [restaurantNutrition.js](#file-src-utils-restaurantnutrition-js) | Restaurant nutrition: detect restaurant queries, build search query, and run full pipeline (Firestore cache + server extraction)… |
| [xlsx.js](#file-src-utils-xlsx-js) | Default fallback for environments that don't match ` |
| [xlsx.native.js](#file-src-utils-xlsx-native-js) | Native (iOS/Android/Expo Go) shim for `xlsx` |
| [xlsx.web.js](#file-src-utils-xlsx-web-js) | Web build uses the real `xlsx` package |

### `src/workouts/` (25)

| File | One-line |
|------|----------|
| [EditModalForm_RN.jsx](#file-src-workouts-components-editmodalform-rn-jsx) | UI-only “nice” edit modal for Workout Plan builder fields |
| [ExerciseCard.js](#file-src-workouts-components-exercisecard-js) | Reusable UI: ExerciseCard. |
| [ExerciseCard.jsx](#file-src-workouts-components-exercisecard-jsx) | Reusable UI: ExerciseCard. |
| [ExerciseCarousel.jsx](#file-src-workouts-components-exercisecarousel-jsx) | Horizontal carousel for ExerciseCard-sized items |
| [ExerciseGrid.jsx](#file-src-workouts-components-exercisegrid-jsx) | Matches `ExerciseLibrarySection` horizontal padding (20 + 20) |
| [ExerciseLibrarySection.jsx](#file-src-workouts-components-exerciselibrarysection-jsx) | Section wrapper for Exercise Library (title + optional subtitle + children) |
| [ExerciseRow.jsx](#file-src-workouts-components-exerciserow-jsx) | ExerciseRow Component  Displays a single exercise with inline editing for sets, reps, rest, and notes |
| [ExerciseSection.js](#file-src-workouts-components-exercisesection-js) | Reusable UI: ExerciseSection. |
| [LoadingOverlay.jsx](#file-src-workouts-components-loadingoverlay-jsx) | Loading Overlay Component  Shows progress messages during workout plan generation |
| [PlanLimitBanner.jsx](#file-src-workouts-components-planlimitbanner-jsx) | Premium-looking plan generation limit banner… |
| [ShortsCard.js](#file-src-workouts-components-shortscard-js) | Shorts thumbnails still use the same endpoint; we just present them 9:16 |
| [VideoPlayerModal.jsx](#file-src-workouts-components-videoplayermodal-jsx) | YouTube IFrame API player (replaces raw WebView embed URLs — helps avoid Error 153)… |
| [WorkoutDayCard.jsx](#file-src-workouts-components-workoutdaycard-jsx) | WorkoutDayCard Component  Displays a workout plan as a day card with exercises |
| [WorkoutExerciseLibraryTab.jsx](#file-src-workouts-components-workoutexerciselibrarytab-jsx) | Same as client `DashboardHeroCard` / Settings — dark pink → dark orange ring |
| [WorkoutPlanPdfViewerModal.js](#file-src-workouts-components-workoutplanpdfviewermodal-js) | In-app PDF viewer for generated workout plan |
| [YouTubeDebugOverlay.jsx](#file-src-workouts-components-youtubedebugoverlay-jsx) | Reusable UI: YouTubeDebugOverlay. |
| [useYouTubeAPI.js](#file-src-workouts-hooks-useyoutubeapi-js) | Reads YouTube Data API v3 key from Expo extra or env (supports legacy REACT_NATIVE_ name)… |
| [ActiveWorkoutScreen.jsx](#file-src-workouts-screens-activeworkoutscreen-jsx) | Try to get active workout for user |
| [workout.js](#file-src-workouts-screens-workout-js) | Workout Plan Generator Screen Review onboarding data, allow edits, and generate personalized workout plan using DeepSeek API |
| [WorkoutHistoryScreen.jsx](#file-src-workouts-screens-workouthistoryscreen-jsx) | Screen: WorkoutHistoryScreen. |
| [workoutPlanBuilderFieldEditBody.js](#file-src-workouts-screens-workoutplanbuilderfieldeditbody-js) | Inline edit bodies for workout plan builder rows — logic copied from WorkoutPlanGeneratorScreen |
| [WorkoutPlanGeneratorScreenUI.js](#file-src-workouts-screens-workoutplangeneratorscreenui-js) | UI wrapper for workout plan generation |
| [claudeWorkoutService.js](#file-src-workouts-services-claudeworkoutservice-js) | Claude Workout Service  Handles workout plan generation and regeneration via Claude API… |
| [workoutPlanPdfService.js](#file-src-workouts-services-workoutplanpdfservice-js) | Workout plan PDF: parse plan text, generate PDF (expo-print), save to Storage + Firestore |
| [workoutService.js](#file-src-workouts-services-workoutservice-js) | Single doc path for current workout plan: users/{uid}/workoutPlan |

---

## <span id="per-file-reference"></span>Per-file reference

### <span id="file-src-ai-components-apikeyinput-js"></span>`src/ai/components/ApiKeyInput.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/components/ApiKeyInput.js` |
| 2. **What it does** | Reusable UI: ApiKeyInput. |
| 3. **Main components/functions** | `default:ApiKeyInput` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../services/apiKeyService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/ChatScreen.js` |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-ai-components-usechat-js"></span>`src/ai/components/useChat.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/components/useChat.js` |
| 2. **What it does** | Custom hook for managing chat state and OpenAI interactions @param {string} chatId - Optional chat ID to load an existing chat @returns {object} Chat state and … |
| 3. **Main components/functions** | `useChat` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../services/chatService`, `../services/apiKeyService`, `../services/chatStorageService`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-ai-screens-assignworkoutscreen-js"></span>`src/ai/screens/AssignWorkoutScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/AssignWorkoutScreen.js` |
| 2. **What it does** | Purpose: Screen for trainers to assign custom workouts to their clients |
| 3. **Main components/functions** | `default:AssignWorkoutScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-ai-screens-chatlistscreen-js"></span>`src/ai/screens/ChatListScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/ChatListScreen.js` |
| 2. **What it does** | Load chats from storage |
| 3. **Main components/functions** | `default:ChatListScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../services/chatStorageService`, `../../Loader`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-ai-screens-chatscreen-js"></span>`src/ai/screens/ChatScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/ChatScreen.js` |
| 2. **What it does** | Screen: ChatScreen. |
| 3. **Main components/functions** | `default:ChatScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../shared/hooks/useChat`, `../services/apiKeyService`, `../components/ApiKeyInput`, `../services/imageService`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-ai-screens-clientdetailscreen-js"></span>`src/ai/screens/ClientDetailScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/ClientDetailScreen.js` |
| 2. **What it does** | Purpose: Detailed view of a specific client with their progress, workouts, and nutrition data |
| 3. **Main components/functions** | `default:ClientDetailScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-ai-screens-clientmanagementscreen-js"></span>`src/ai/screens/ClientManagementScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/ClientManagementScreen.js` |
| 2. **What it does** | Purpose: Main screen for trainers to view and manage all their clients |
| 3. **Main components/functions** | `default:ClientManagementScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-ai-screens-conversationsettingsscreen-js"></span>`src/ai/screens/ConversationSettingsScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/ConversationSettingsScreen.js` |
| 2. **What it does** | Purpose: Settings screen for individual conversation (mute, delete, block, etc |
| 3. **Main components/functions** | `default:ConversationSettingsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-ai-screens-trainerprofilescreen-jsx"></span>`src/ai/screens/TrainerProfileScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/TrainerProfileScreen.jsx` |
| 2. **What it does** | Screen: TrainerProfileScreen. |
| 3. **Main components/functions** | `default:TrainerProfileScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`, `../../shared/components/ReviewSubmitSheet`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-ai-screens-trainersearchscreen-js"></span>`src/ai/screens/TrainerSearchScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/screens/TrainerSearchScreen.js` |
| 2. **What it does** | No in-app review surface yet — hide ratings/reviews and related filters (Firestore may still have legacy/seeded values) |
| 3. **Main components/functions** | `default:TrainerSearchScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/BlurBackdropPlate`, `../../app/config`, `../../shared/utils/trainerProfileMedia`, `../../navigation/BottomNavBar`, `../../marketplace/components/TrainerRequestConfirmModal`, `../../marketplace/components/TrainerRequestIntroModal`, `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/trainer/screens/TrainerSearchScreen.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-ai-services-apikeyservice-js"></span>`src/ai/services/apiKeyService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/apiKeyService.js` |
| 2. **What it does** | Load API key from AsyncStorage and configure OpenAI Also checks environment variables as fallback |
| 3. **Main components/functions** | `configureOpenAI`, `getOpenAIKey`, `loadApiKey`, `saveApiKey`, `getCurrentApiKey`, `hasApiKey` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/components/ApiKeyInput.js`, `src/ai/components/useChat.js`, `src/ai/screens/ChatScreen.js`, `src/ai/services/askServer.js`, `src/ai/services/openaiClient.js`, `src/ai/services/webSearch.js`, `src/app/AuthGate.js`, `src/shared/hooks/useChat.js` |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-ai-services-askserver-js"></span>`src/ai/services/askServer.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/askServer.js` |
| 2. **What it does** | Resolve backend URL |
| 3. **Main components/functions** | `askServer` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./apiKeyService`, `../../shared/services/baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/services/openaiClient.js` |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-ai-services-chatservice-js"></span>`src/ai/services/chatService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/chatService.js` |
| 2. **What it does** | Sanitize user input: remove special symbols (#, *, $, etc |
| 3. **Main components/functions** | `sanitizeInput`, `sendChatMessage`, `generateWorkoutResponse` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./openaiClient`, `./imageService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/components/useChat.js`, `src/shared/hooks/useChat.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-ai-services-chatstorageservice-js"></span>`src/ai/services/chatStorageService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/chatStorageService.js` |
| 2. **What it does** | Chat structure: {   id: string (unique ID),   title: string (first message or "New Chat"),   messages: Array<{ role: 'user'\|'assistant', content: string, imageU… |
| 3. **Main components/functions** | `getAllChats`, `getChatById`, `saveChat`, `createNewChat`, `deleteChat`, `updateChatMessages`, `getCurrentChatId`, `setCurrentChatId` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/components/useChat.js`, `src/ai/screens/ChatListScreen.js`, `src/app/AuthGate.js`, `src/shared/hooks/useChat.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-ai-services-claudeclient-js"></span>`src/ai/services/claudeClient.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/claudeClient.js` |
| 2. **What it does** | Claude AI Client  Simple, modular Claude API client for workout generation… |
| 3. **Main components/functions** | `sendClaudePrompt`, `generateWorkoutPlan` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../claudeClient`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-ai-services-conversationservice-js"></span>`src/ai/services/conversationService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/conversationService.js` |
| 2. **What it does** | Subscribe to real-time conversation updates for a user @param {string} userId - The user's ID @param {Function} callback - Callback function to receive conversa… |
| 3. **Main components/functions** | `subscribeToConversations`, `subscribeToUnreadCount`, `subscribeToUnreadByConversation` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `./trainerMessaging`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/trainer/screens/ConversationsListScreen.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-ai-services-imageservice-js"></span>`src/ai/services/imageService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/imageService.js` |
| 2. **What it does** | Request camera/media library permissions |
| 3. **Main components/functions** | `requestImagePermissions`, `pickImage`, `prepareImageForOpenAI` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/ChatScreen.js`, `src/ai/services/chatService.js`, `src/auth/AuthScreen.js` |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-ai-services-markallmessagesread-js"></span>`src/ai/services/markAllMessagesRead.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/markAllMessagesRead.js` |
| 2. **What it does** | Utility to mark all messages as read for a user |
| 3. **Main components/functions** | `markAllMessagesReadForUser` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-ai-services-openaiclient-js"></span>`src/ai/services/openaiClient.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/openaiClient.js` |
| 2. **What it does** | generateResponse Sends a user prompt to the GPT model and returns { text, raw }… |
| 3. **Main components/functions** | `configureOpenAI`, `generateResponse` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./openaiClient`, `./webSearch`, `./askServer`, `./apiKeyService`, `../../shared/services/baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/services/chatService.js`, `src/ai/services/openaiClient.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-ai-services-prompts-js"></span>`src/ai/services/prompts.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/prompts.js` |
| 2. **What it does** | AI prompt templates for consistent responses |
| 3. **Main components/functions** | `MEAL_PLAN_PROMPT`, `WORKOUT_PROMPT`, `COACH_PROMPT`, `NUTRITION_ANALYSIS_PROMPT` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-ai-services-trainermessaging-js"></span>`src/ai/services/trainerMessaging.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/trainerMessaging.js` |
| 2. **What it does** | Get or create a conversation between a client and trainer @param {string} clientId - The client's user ID @param {string} trainerId - The trainer's user ID @ret… |
| 3. **Main components/functions** | `getOrCreateConversation`, `sendMessage`, `sendAttachmentMessage`, `sendClientRequest`, `updateMessageStatus`, `getMessages`, `subscribeToMessages`, `getUserConversations`, `TYPING_UI_STALE_MS` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/services/pushNotifyApi`, `../../shared/notifications/pushCopy`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/services/conversationService.js`, `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/trainer/components/TrainerMarketplaceModal.js`, `src/trainer/screens/ConversationsListScreen.js`, `src/trainer/screens/TrainerMessagingScreen.js`, `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-ai-services-websearch-js"></span>`src/ai/services/webSearch.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/ai/services/webSearch.js` |
| 2. **What it does** | Resolve backend URL for server-side web search |
| 3. **Main components/functions** | `searchWeb`, `getWebContext` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./apiKeyService`, `../../shared/services/baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/services/openaiClient.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-aichat-components-miniorb-jsx"></span>`src/aiChat/components/MiniOrb.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/aiChat/components/MiniOrb.jsx` |
| 2. **What it does** | Reusable UI: MiniOrb. |
| 3. **Main components/functions** | `default:MiniOrb` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-aichat-screens-aichathomescreen-jsx"></span>`src/aiChat/screens/AIChatHomeScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/aiChat/screens/AIChatHomeScreen.jsx` |
| 2. **What it does** | AIChatHomeScreen… |
| 3. **Main components/functions** | `default:AIChatHomeScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../navigation/BottomNavBar`, `../../shared/components/CoachConnectHeader`, `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/aiChat/screens/VoiceAIHomeScreen.jsx`, `src/app/ClientApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-aichat-screens-aichatscreen-jsx"></span>`src/aiChat/screens/AIChatScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/aiChat/screens/AIChatScreen.jsx` |
| 2. **What it does** | AIChatScreen… |
| 3. **Main components/functions** | `default:AIChatScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`, `../../shared/ui/ThemeContext`, `../../shared/services/baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/aiChat/screens/VoiceAIChatScreen.jsx`, `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-aichat-screens-voiceaichatscreen-jsx"></span>`src/aiChat/screens/VoiceAIChatScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/aiChat/screens/VoiceAIChatScreen.jsx` |
| 2. **What it does** | Screen: VoiceAIChatScreen. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-aichat-screens-voiceaihomescreen-jsx"></span>`src/aiChat/screens/VoiceAIHomeScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/aiChat/screens/VoiceAIHomeScreen.jsx` |
| 2. **What it does** | Screen: VoiceAIHomeScreen. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-app-authgate-js"></span>`src/app/AuthGate.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/AuthGate.js` |
| 2. **What it does** | AuthGate - Handles authentication state and routes to appropriate app  Responsibilities: - Shows splash screen initially - Handles auth flow (login, signup, for… |
| 3. **Main components/functions** | `default:AuthGate` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../auth/AuthScreen`, `../auth/ForgotPasswordScreen`, `../auth/OnboardingScreen`, `./TrainerApp`, `./ClientApp`, `../shared/components/AppLoadingScreen`, `./config`, `../../utils/syncErrorsToServer`, `../ai/services/apiKeyService`, `../ai/services/chatStorageService`, `../utils/clearDataOnLogout`, `../shared/services/onboardingSync`, `../shared/services/notificationsService`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-app-calculations-js"></span>`src/app/calculations.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/calculations.js` |
| 2. **What it does** | BMR calculation using Mifflin-St Jeor equation |
| 3. **Main components/functions** | `calculateBMR`, `calculateTDEE`, `calculateMacros`, `estimateBodyFat`, `calculateBMI`, `calculateWeightGoal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/client/screens/DashboardScreen.js`, `src/trainer/components/NutritionView.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-app-clientapp-js"></span>`src/app/ClientApp.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/ClientApp.js` |
| 2. **What it does** | ClientApp - Client-specific application interface with integrated home screen  Responsibilities: - Client dashboard rendering - Client screen navigation and sta… |
| 3. **Main components/functions** | `default:ClientApp` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../shared/ui/BlurBackdropPlate`, `./config`, `./calculations`, `./dateKey`, `../ai/services/conversationService`, `../ai/services/trainerMessaging`, `../aiChat/screens/AIChatHomeScreen`, `../aiChat/screens/AIChatScreen`, `../ai/screens/TrainerSearchScreen`, `../client/screens/MyDashboardScreen`, `../client/screens/SettingsScreen`, `../settings/screens/HelpFAQScreen`, `../settings/screens/TermsOfServiceScreen`, `../settings/screens/PrivacyPolicyScreen`, `../settings/screens/ContactSupportScreen`; packages/other: — … |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-app-config-js"></span>`src/app/config.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/config.js` |
| 2. **What it does** | Get Firebase config from environment variables |
| 3. **Main components/functions** | `default:supabase` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../supabase/supabase-js`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerProfileScreen.jsx`, `src/ai/screens/TrainerSearchScreen.js`, `src/ai/services/chatStorageService.js`, `src/ai/services/conversationService.js`, `src/ai/services/markAllMessagesRead.js`, `src/ai/services/trainerMessaging.js`, `src/aiChat/screens/AIChatHomeScreen.jsx`, `src/aiChat/screens/AIChatScreen.jsx`, `src/app/AuthGate.js`, `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/auth/AuthScreen.js`, `src/auth/OnboardingScreen.js`, `src/client/screens/DashboardScreen.js`, `src/client/screens/MyDashboardScreen.jsx`, `src/client/screens/ProfileScreen.js`, `src/client/screens/SettingsScreen.js`, `src/contexts/AIContext.js`, `src/hooks/use-sessions.js`, `src/nutrition/screens/FoodSearchScreen.js`, `src/nutrition/screens/MacroTrackerScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx`, `src/nutrition/daily-log/logFoodToFirestore.js`, `src/profile/screens/ProfileScreen.jsx`, `src/screens/settings/ForgotPassword.js`, `src/shared/components/AddNotesFilesModal.js`, `src/shared/components/RemoveTrainerSheet.js`, `src/shared/components/ReviewSubmitSheet.js`, `src/shared/services/notesAndFilesService.js`, `src/shared/services/notificationsService.js`, `src/shared/services/storage.js`, `src/trainer/components/MessagesView.jsx`, `src/trainer/components/NutritionView.jsx`, `src/trainer/components/ProgressView.jsx`, `src/trainer/components/TrainerMarketplaceModal.js`, `src/trainer/components/TrainerWeeklyReportSection.jsx`, `src/trainer/hooks/useTrainerClients.js`, `src/trainer/screens/AIWorkoutPlansScreen.js`, `src/trainer/screens/ClientRequestsScreen.js`, `src/trainer/screens/ConversationsListScreen.js`, `src/trainer/screens/PhotoGalleryScreen.js`, `src/trainer/screens/TrainerMessagingScreen.js`, `src/trainer/screens/TrainerWeeklyReportScreen.jsx`, `src/trainer/services/manualWorkoutPlanService.js`, `src/trainer/services/pushSessionNotification.js`, `src/trainer/services/scheduleService.js`, `src/trainer/services/trainerPendingRequestsService.js`, `src/utils/migrateTrainers.js`, `src/utils/restaurantNutrition.js`, `src/workouts/components/WorkoutPlanPdfViewerModal.js`, `src/workouts/screens/ActiveWorkoutScreen.jsx`, `src/workouts/screens/WorkoutHistoryScreen.jsx`, `src/workouts/screens/workout.js`, `src/workouts/services/workoutPlanPdfService.js`, `src/workouts/services/workoutService.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-app-datekey-js"></span>`src/app/dateKey.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/dateKey.js` |
| 2. **What it does** | Daily log date key — resets every 24 hours at midnight America/New_York… |
| 3. **Main components/functions** | `default:getDateKey`, `getDateKey` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-app-permissions-js"></span>`src/app/permissions.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/permissions.js` |
| 2. **What it does** | Request camera permission |
| 3. **Main components/functions** | `requestCameraPermission`, `requestMicrophonePermission`, `requestPhotoLibraryPermission`, `checkAllPermissions`, `requestAllPermissions`, `arePermissionsGranted` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-app-rolemigrationscreen-js"></span>`src/app/RoleMigrationScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/RoleMigrationScreen.js` |
| 2. **What it does** | import { migrateUserRoles, setTrainersByEmail } from ' |
| 3. **Main components/functions** | `default:RoleMigrationScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../shared/ui/ThemeContext`, `../utils/migrateUserRoles`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-app-trainerapp-js"></span>`src/app/TrainerApp.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/app/TrainerApp.js` |
| 2. **What it does** | TrainerApp… |
| 3. **Main components/functions** | `default:TrainerApp`, `getClient`, `createOrUpdateClient`, `syncClientDataFromUsers`, `removeClient`, `getTrainerClients`, `updateClient`, `addProgress`, `getProgressHistory` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../shared/ui/BlurBackdropPlate`, `../shared/components/DailyQuoteCard`, `../shared/components/HoldToConfirmModal`, `../shared/components/CoachConnectHeader`, `../navigation/BottomNavBar`, `../navigation/AppNavigationContext`, `../trainer/screens/TrainerSearchScreen`, `../trainer/screens/TrainerMessagingScreen`, `../trainer/screens/ConversationsListScreen`, `../aiChat/screens/VoiceAIHomeScreen`, `../aiChat/screens/AIChatScreen`, `../nutrition/screens/NutritionContainer`, `../profile/screens/ProfileScreen`, `../client/screens/SettingsScreen`, `../settings/screens/HelpFAQScreen`; packages/other: — … |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-auth-authscreen-js"></span>`src/auth/AuthScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/auth/AuthScreen.js` |
| 2. **What it does** | AuthScreen - Combined authentication screen  * Combines WelcomeScreen, RoleSelectionScreen, SignupScreen, and LoginScreen into a single file with internal state… |
| 3. **Main components/functions** | `default:AuthScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../shared/ui/ThemeContext`, `../app/config`, `../ai/services/imageService`, `../shared/services/storage`, `../shared/ui/liquid/LiquidBackground`, `../shared/ui/liquid/LiquidBackgroundLight`, `../shared/ui/liquid/LiquidGlassCard`, `../components/ErrorModal`, `../shared/ui/liquid/LiquidGradientButton`, `../shared/ui/liquid/liquidTokens`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-auth-forgotpasswordscreen-js"></span>`src/auth/ForgotPasswordScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/auth/ForgotPasswordScreen.js` |
| 2. **What it does** | Source module `ForgotPasswordScreen` under auth/. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-auth-onboardingscreen-js"></span>`src/auth/OnboardingScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/auth/OnboardingScreen.js` |
| 2. **What it does** | OnboardingScreen - Combined onboarding flow for clients and trainers  Handles all 6 onboarding steps for both client and trainer roles with Apple-style subtle g… |
| 3. **Main components/functions** | `default:OnboardingScreen`, `OnboardingProgressBar`, `SelectionCard`, `OnboardingTextArea`, `OnboardingSectionLabel`, `OnboardingInputRow`, `OnboardingDayPicker`, `OnboardingOptionChips`, `OnboardingMultiSelectPills`, `onboardingHeadingStyles` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../shared/ui/ThemeContext`, `../app/config`, `../shared/ui/BlurBackdropPlate`, `../shared/services/baseUrl`, `../shared/services/onboardingSync`, `../contexts/AIContext`, `../shared/components/onboarding/AIOptInStep`, `../shared/ui/liquid/LiquidBackground`, `../shared/ui/liquid/LiquidBackgroundLight`, `../shared/assets/onboardingIconRegistry`, `../assets/lottie/personal-info.json`, `../assets/lottie/fitness-experience.json`, `../assets/lottie/fitness-goal.json`, `../assets/Lotties for Anatrox/fitness (1).json`, `../assets/lottie/training-frequency.json`; packages/other: — … |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-client-components-dashboardherocard-jsx"></span>`src/client/components/DashboardHeroCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/DashboardHeroCard.jsx` |
| 2. **What it does** | Matches Aurora hero + Settings: dark pink → dark orange |
| 3. **Main components/functions** | `default:DashboardHeroCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-files-filecard-jsx"></span>`src/client/components/files/FileCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/files/FileCard.jsx` |
| 2. **What it does** | Thumbnails: for images we can safely fall back to the full download URL |
| 3. **Main components/functions** | `FileCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../../shared/utils/fileFormatting`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/components/files/MyFilesSection.jsx`, `src/client/components/files/TrainerSharedSection.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-files-myfilessection-jsx"></span>`src/client/components/files/MyFilesSection.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/files/MyFilesSection.jsx` |
| 2. **What it does** | Reusable UI: MyFilesSection. |
| 3. **Main components/functions** | `MyFilesSection` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./FileCard`, `../../../shared/services/notesAndFilesService`, `../../../shared/utils/fileFormatting`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-client-components-files-notesfromtrainersection-jsx"></span>`src/client/components/files/NotesFromTrainerSection.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/files/NotesFromTrainerSection.jsx` |
| 2. **What it does** | Reusable UI: NotesFromTrainerSection. |
| 3. **Main components/functions** | `NotesFromTrainerSection` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../../shared/utils/fileFormatting`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-files-trainersharedsection-jsx"></span>`src/client/components/files/TrainerSharedSection.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/files/TrainerSharedSection.jsx` |
| 2. **What it does** | Reusable UI: TrainerSharedSection. |
| 3. **Main components/functions** | `TrainerSharedSection` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./FileCard`, `../../../shared/utils/fileFormatting`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-marketplaceherocard-jsx"></span>`src/client/components/MarketplaceHeroCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/MarketplaceHeroCard.jsx` |
| 2. **What it does** | Cohesive accent rim (pink → purple) |
| 3. **Main components/functions** | `default:MarketplaceHeroCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/trainer/screens/SessionFormScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-premiumstatssection-jsx"></span>`src/client/components/PremiumStatsSection.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/PremiumStatsSection.jsx` |
| 2. **What it does** | Same palette as session meeting cards: cyan → purple → pink |
| 3. **Main components/functions** | `default:PremiumStatsSection`, `GradientBorderShell` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/screens/MyDashboardScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-premiumtrainercard-jsx"></span>`src/client/components/PremiumTrainerCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/PremiumTrainerCard.jsx` |
| 2. **What it does** | PremiumTrainerCard - Prominent, tappable trainer card with gradient avatar ring, badges, and CTA |
| 3. **Main components/functions** | `default:PremiumTrainerCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/utils/trainerProfileMedia`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/screens/MyDashboardScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-premiumwelcomecard-jsx"></span>`src/client/components/PremiumWelcomeCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/PremiumWelcomeCard.jsx` |
| 2. **What it does** | PremiumWelcomeCard - Glass card with mascot/illustration, personalized greeting, and one clear primary action |
| 3. **Main components/functions** | `default:PremiumWelcomeCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/screens/MyDashboardScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-trainerprofilecardmodal-jsx"></span>`src/client/components/TrainerProfileCardModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/TrainerProfileCardModal.jsx` |
| 2. **What it does** | Reusable UI: TrainerProfileCardModal. |
| 3. **Main components/functions** | `default:TrainerProfileCardModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-components-weeklyreportherocard-jsx"></span>`src/client/components/WeeklyReportHeroCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/components/WeeklyReportHeroCard.jsx` |
| 2. **What it does** | Soft violet / blush rim (not harsh red) |
| 3. **Main components/functions** | `default:WeeklyReportHeroCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/screens/MyDashboardScreen.jsx`, `src/trainer/components/TrainerWeeklyReportSection.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-accountprofilescreen-jsx"></span>`src/client/screens/AccountProfileScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/AccountProfileScreen.jsx` |
| 2. **What it does** | Screen: AccountProfileScreen. |
| 3. **Main components/functions** | `default:AccountProfileScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-clientfilesscreen-jsx"></span>`src/client/screens/ClientFilesScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/ClientFilesScreen.jsx` |
| 2. **What it does** | Screen: ClientFilesScreen. |
| 3. **Main components/functions** | `default:ClientFilesScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/services/notesAndFilesService`, `../../shared/utils/notesFileView`, `../../shared/utils/fileFormatting`, `../../shared/components/PdfViewerModal`, `../../shared/components/SpreadsheetViewerModal`, `../../shared/components/DocumentViewerModal`, `../../shared/components/MediaViewerModal`, `../../shared/components/EmbedWebViewModal`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-dashboardscreen-js"></span>`src/client/screens/DashboardScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/DashboardScreen.js` |
| 2. **What it does** | Helper function to calculate calorie goal |
| 3. **Main components/functions** | `default:DashboardScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/theme`, `../../app/config`, `../../nutrition/daily-log/logFoodToFirestore`, `../../workouts/services/workoutService`, `../../app/calculations`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-client-screens-datastoragescreen-jsx"></span>`src/client/screens/DataStorageScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/DataStorageScreen.jsx` |
| 2. **What it does** | Screen: DataStorageScreen. |
| 3. **Main components/functions** | `default:DataStorageScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-goalstargetsscreen-jsx"></span>`src/client/screens/GoalsTargetsScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/GoalsTargetsScreen.jsx` |
| 2. **What it does** | Screen: GoalsTargetsScreen. |
| 3. **Main components/functions** | `default:GoalsTargetsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-mydashboardscreen-jsx"></span>`src/client/screens/MyDashboardScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/MyDashboardScreen.jsx` |
| 2. **What it does** | Hide trainer bios that look like keyboard mash / test strings (e |
| 3. **Main components/functions** | `default:MyDashboardScreen`, `MyDashboardScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/services/pushNotifyApi`, `../../shared/utils/getLocalDay`, `../../shared/ui/ThemeContext`, `../../shared/components/SessionMeetingCard`, `../components/PremiumWelcomeCard`, `../components/PremiumTrainerCard`, `../components/WeeklyReportHeroCard`, `../components/PremiumStatsSection`, `../../shared/utils/workoutDayLabels`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-client-screens-notificationssettingsscreen-jsx"></span>`src/client/screens/NotificationsSettingsScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/NotificationsSettingsScreen.jsx` |
| 2. **What it does** | Screen: NotificationsSettingsScreen. |
| 3. **Main components/functions** | `default:NotificationsSettingsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-privacysecurityscreen-jsx"></span>`src/client/screens/PrivacySecurityScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/PrivacySecurityScreen.jsx` |
| 2. **What it does** | Screen: PrivacySecurityScreen. |
| 3. **Main components/functions** | `default:PrivacySecurityScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-profilescreen-js"></span>`src/client/screens/ProfileScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/ProfileScreen.js` |
| 2. **What it does** | --- Reusable Components --- |
| 3. **Main components/functions** | `default:ProfileScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../../shared/ui/BlurBackdropPlate`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`, `../../navigation/AppNavigationContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-client-screens-progressanalyticsscreen-js"></span>`src/client/screens/ProgressAnalyticsScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/ProgressAnalyticsScreen.js` |
| 2. **What it does** | Screen: ProgressAnalyticsScreen. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-settingsscreen-js"></span>`src/client/screens/SettingsScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/SettingsScreen.js` |
| 2. **What it does** | Settings UI — dark pink → dark orange gradient (no purple) |
| 3. **Main components/functions** | `default:SettingsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`, `../../contexts/AIContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-client-screens-socialsharingscreen-jsx"></span>`src/client/screens/SocialSharingScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/SocialSharingScreen.jsx` |
| 2. **What it does** | Screen: SocialSharingScreen. |
| 3. **Main components/functions** | `default:SocialSharingScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-client-screens-unitsmeasurementsscreen-jsx"></span>`src/client/screens/UnitsMeasurementsScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/client/screens/UnitsMeasurementsScreen.jsx` |
| 2. **What it does** | Screen: UnitsMeasurementsScreen. |
| 3. **Main components/functions** | `default:UnitsMeasurementsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-components-errormodal-jsx"></span>`src/components/ErrorModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/components/ErrorModal.jsx` |
| 2. **What it does** | CoachConnect-styled error / alert modal (gradient rim, glass inner, optional retry) |
| 3. **Main components/functions** | `default:ErrorModal`, `ErrorModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/AuthScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-components-monthcalendar-jsx"></span>`src/components/MonthCalendar.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/components/MonthCalendar.jsx` |
| 2. **What it does** | Source module `MonthCalendar` under components/. |
| 3. **Main components/functions** | `MonthCalendar` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/SessionSchedulingScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-components-sessioncalendar-jsx"></span>`src/components/SessionCalendar.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/components/SessionCalendar.jsx` |
| 2. **What it does** | Source module `SessionCalendar` under components/. |
| 3. **Main components/functions** | `SessionCalendar` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-components-sessioncard-jsx"></span>`src/components/SessionCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/components/SessionCard.jsx` |
| 2. **What it does** | Source module `SessionCard` under components/. |
| 3. **Main components/functions** | `SessionCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../lib/sessions`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/SessionSchedulingScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-components-wheelpicker-jsx"></span>`src/components/WheelPicker.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/components/WheelPicker.jsx` |
| 2. **What it does** | Wheel row values — full white reads better on tinted glass than low-opacity #000 |
| 3. **Main components/functions** | `WheelPicker` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/SessionFormScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-contexts-aicontext-js"></span>`src/contexts/AIContext.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/contexts/AIContext.js` |
| 2. **What it does** | Canonical per-user AI toggle — survives AuthGate profile refresh; key avoids clearAllUserData() coachconnect_* wipe |
| 3. **Main components/functions** | `AIProvider`, `useAI` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/OnboardingScreen.js`, `src/client/screens/SettingsScreen.js`, `src/navigation/BottomNavBar.js`, `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-hooks-use-sessions-js"></span>`src/hooks/use-sessions.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/hooks/use-sessions.js` |
| 2. **What it does** | useSessions — Trainer-wide session scheduling (across all clients)… |
| 3. **Main components/functions** | `useSessions` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../app/config`, `../trainer/hooks/useTrainerClients`, `../trainer/services/pushSessionNotification`, `../shared/services/pushNotifyApi`, `../shared/notifications/pushCopy`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/SessionFormScreen.jsx`, `src/trainer/screens/SessionSchedulingScreen.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-lib-sessions-js"></span>`src/lib/sessions.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/lib/sessions.js` |
| 2. **What it does** | Source module `sessions` under lib/. |
| 3. **Main components/functions** | `pad2`, `formatDateLong`, `formatTime12` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/components/SessionCard.jsx`, `src/shared/components/SessionMeetingCard.jsx`, `src/trainer/screens/SessionSchedulingScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-loader-js"></span>`src/Loader.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/Loader.js` |
| 2. **What it does** | Create animated values for each dot |
| 3. **Main components/functions** | `default:Loader` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/ChatListScreen.js`, `src/nutrition/screens/MacroTrackerScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/shared/components/LoadingSpinner.js`, `src/workouts/screens/ActiveWorkoutScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-marketplace-components-trainerrequestconfirmmodal-jsx"></span>`src/marketplace/components/TrainerRequestConfirmModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/marketplace/components/TrainerRequestConfirmModal.jsx` |
| 2. **What it does** | Reusable UI: TrainerRequestConfirmModal. |
| 3. **Main components/functions** | `default:TrainerRequestConfirmModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/utils/trainerProfileMedia`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerSearchScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-marketplace-components-trainerrequestintromodal-jsx"></span>`src/marketplace/components/TrainerRequestIntroModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/marketplace/components/TrainerRequestIntroModal.jsx` |
| 2. **What it does** | Reusable UI: TrainerRequestIntroModal. |
| 3. **Main components/functions** | `default:TrainerRequestIntroModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerSearchScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-navigation-appnavigationcontext-js"></span>`src/navigation/AppNavigationContext.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/navigation/AppNavigationContext.js` |
| 2. **What it does** | AppNavigationContext - Centralized navigation for CoachConnect header and bottom nav  * Apps (ClientApp, TrainerApp) provide handlers via the provider… |
| 3. **Main components/functions** | `AppNavigationProvider`, `useAppNavigation`, `useMergedNavigation` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ProfileScreen.js`, `src/navigation/BottomNavBar.js`, `src/shared/components/CoachConnectHeader.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-navigation-bottomnavbar-js"></span>`src/navigation/BottomNavBar.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/navigation/BottomNavBar.js` |
| 2. **What it does** | Logo-aligned vertical gradient for all tab icons (pink → purple → indigo) |
| 3. **Main components/functions** | `default:BottomNavBar` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../shared/ui/ThemeContext`, `./AppNavigationContext`, `../shared/ui/BlurBackdropPlate`, `../shared/components/GradientGeminiNavIcon`, `../contexts/AIContext`, `../shared/ui/brandGradients`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerProfileScreen.jsx`, `src/ai/screens/TrainerSearchScreen.js`, `src/aiChat/screens/AIChatHomeScreen.jsx`, `src/aiChat/screens/AIChatScreen.jsx`, `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ProfileScreen.js`, `src/client/screens/SettingsScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx`, `src/profile/screens/ProfileScreen.jsx`, `src/settings/screens/BugReportScreen.jsx`, `src/settings/screens/ContactSupportScreen.jsx`, `src/settings/screens/HelpFAQScreen.jsx`, `src/settings/screens/PrivacyPolicyScreen.jsx`, `src/settings/screens/TermsOfServiceScreen.jsx`, `src/shared/components/DocumentEditorModal.js`, `src/shared/components/SpreadsheetEditorModal.js`, `src/trainer/screens/TrainerWeeklyReportScreen.jsx`, `src/workouts/screens/ActiveWorkoutScreen.jsx`, `src/workouts/screens/WorkoutHistoryScreen.jsx`, `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-navigation-customnavigationbar-jsx"></span>`src/navigation/CustomNavigationBar.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/navigation/CustomNavigationBar.jsx` |
| 2. **What it does** | Animate the outline |
| 3. **Main components/functions** | `default:CustomNavigationBar` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-components-editservingmodal-jsx"></span>`src/nutrition/components/EditServingModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/components/EditServingModal.jsx` |
| 2. **What it does** | Slim “Edit serving” dialog for a food log — gradient accents, compact fields |
| 3. **Main components/functions** | `default:EditServingModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./GradientFieldFrame`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-components-fooditem-js"></span>`src/nutrition/components/FoodItem.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/components/FoodItem.js` |
| 2. **What it does** | Calories from FatSecret are base calories per serving |
| 3. **Main components/functions** | `default:FoodItem` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/components/MealCard.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-components-gradientfieldframe-jsx"></span>`src/nutrition/components/GradientFieldFrame.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/components/GradientFieldFrame.jsx` |
| 2. **What it does** | Soft violet→mauve→steel border (matches FoodSearchScreen, not harsh rainbow) |
| 3. **Main components/functions** | `default:GradientFieldFrame` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/components/EditServingModal.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-components-macrobar-js"></span>`src/nutrition/components/MacroBar.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/components/MacroBar.js` |
| 2. **What it does** | Reusable UI: MacroBar. |
| 3. **Main components/functions** | `default:MacroBar` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/MacroTrackerScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-components-mealcard-js"></span>`src/nutrition/components/MealCard.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/components/MealCard.js` |
| 2. **What it does** | Reusable UI: MealCard. |
| 3. **Main components/functions** | `default:MealCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `./FoodItem`, `../../shared/ui/FluidGlass`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/MealPlanHomeScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-screens-barcodescannerscreen-js"></span>`src/nutrition/screens/BarcodeScannerScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/BarcodeScannerScreen.js` |
| 2. **What it does** | Barcode viewfinder corners — dark pink / dark orange |
| 3. **Main components/functions** | `default:BarcodeScannerScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../services/foodSearchProvider`, `../services/nutritionService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-screens-foodsearchscreen-js"></span>`src/nutrition/screens/FoodSearchScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/FoodSearchScreen.js` |
| 2. **What it does** | COACHCONNECT — Food Search Screen (Full Rewrite)  * Search priority:   1… |
| 3. **Main components/functions** | `default:FoodSearchScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../services/nutritionService`, `../../app/config`, `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-nutrition-screens-macrotrackerscreen-js"></span>`src/nutrition/screens/MacroTrackerScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/MacroTrackerScreen.js` |
| 2. **What it does** | Screen: MacroTrackerScreen. |
| 3. **Main components/functions** | `default:MacroTrackerScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../services/nutritionService`, `../components/MacroBar`, `../../Loader`, `../../utils/autoLogError`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-nutrition-screens-mealplanhomescreen-js"></span>`src/nutrition/screens/MealPlanHomeScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/MealPlanHomeScreen.js` |
| 2. **What it does** | ICON GOES HERE — refresh debug indicator |
| 3. **Main components/functions** | `default:MealPlanHomeScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../services/nutritionService`, `./FoodSearchScreen`, `../../utils/autoLogError`, `../../Loader`, `./BarcodeScannerScreen`, `./NutritionSettingsScreen`, `../components/MealCard`, `../components/MacroBar`, `../../shared/ui/FluidGlass`, `../../navigation/BottomNavBar`, `../../shared/components/CoachConnectHeader`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-nutrition-screens-nutritioncontainer-jsx"></span>`src/nutrition/screens/NutritionContainer.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/NutritionContainer.jsx` |
| 2. **What it does** | Build a dedup key from food name + meal type + date |
| 3. **Main components/functions** | `default:NutritionContainer`, `NutritionContainer` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../app/dateKey`, `../../shared/ui/ThemeContext`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`, `../services/nutritionService`, `./NutritionOnboardingScreen`, `./NutritionScreen`, `./QuickAddNutrition`, `./FoodSearchScreen`, `./BarcodeScannerScreen`, `./NutritionSettingsScreen`, `../components/EditServingModal`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-nutrition-screens-nutritiononboardingscreen-jsx"></span>`src/nutrition/screens/NutritionOnboardingScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/NutritionOnboardingScreen.jsx` |
| 2. **What it does** | ANATROX — Nutrition Onboarding Screen Converted from Lovable web export (Nutrition_Onboarding… |
| 3. **Main components/functions** | `default:NutritionOnboardingScreen`, `NutritionOnboardingScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../firebase/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-nutrition-screens-nutritionscreen-jsx"></span>`src/nutrition/screens/NutritionScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/NutritionScreen.jsx` |
| 2. **What it does** | Meal card action row — matches vibrant macro / brand styling |
| 3. **Main components/functions** | `default:NutritionScreen`, `NutritionScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-screens-nutritionsettingsscreen-js"></span>`src/nutrition/screens/NutritionSettingsScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/NutritionSettingsScreen.js` |
| 2. **What it does** | COACHCONNECT — Nutrition Settings Screen Edit daily goals (calories, protein, carbs, fat) and reset to onboarding |
| 3. **Main components/functions** | `default:NutritionSettingsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-screens-quickaddnutrition-jsx"></span>`src/nutrition/screens/QuickAddNutrition.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/QuickAddNutrition.jsx` |
| 2. **What it does** | Screen: QuickAddNutrition. |
| 3. **Main components/functions** | `default:QuickAddNutrition`, `QuickAddNutrition` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/NutritionContainer.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-screens-quickaddscreen-jsx"></span>`src/nutrition/screens/QuickAddScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/screens/QuickAddScreen.jsx` |
| 2. **What it does** | Full-page Quick Add (manual food log) |
| 3. **Main components/functions** | `default:QuickAddScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-nutrition-services-foodsearchprovider-js"></span>`src/nutrition/services/foodSearchProvider.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/services/foodSearchProvider.js` |
| 2. **What it does** | Food Search Provider Single source of truth for all food search operations Integrates with server endpoints for secure API calls |
| 3. **Main components/functions** | `default:new`, `FOOD_SEARCH_OFFLINE_HINT` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/services/baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/screens/BarcodeScannerScreen.js`, `src/nutrition/daily-log/logFoodToFirestore.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-nutrition-services-nutritionservice-js"></span>`src/nutrition/daily-log/logFoodToFirestore.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/daily-log/logFoodToFirestore.js` |
| 2. **What it does** | Auto-log the error |
| 3. **Main components/functions** | `getDailyGoals`, `upsertDailyGoals`, `getFoodLogsForDate`, `addFoodLog`, `updateFoodLog`, `deleteFoodLog`, `calculateMacroTotals`, `splitLogsByMeal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `./foodSearchProvider`, `../../utils/autoLogError`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/DashboardScreen.js`, `src/nutrition/screens/BarcodeScannerScreen.js`, `src/nutrition/screens/FoodSearchScreen.js`, `src/nutrition/screens/MacroTrackerScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx`, `src/trainer/components/NutritionView.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-nutrition-utils-nutritionnormalization-js"></span>`src/nutrition/utils/nutritionNormalization.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/nutrition/utils/nutritionNormalization.js` |
| 2. **What it does** | Nutrition portion normalization for Open Food Facts and other sources… |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-profile-screens-profilescreen-jsx"></span>`src/profile/screens/ProfileScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/profile/screens/ProfileScreen.jsx` |
| 2. **What it does** | Height in Firestore may be a number (inches), string, or legacy object shape… |
| 3. **Main components/functions** | `default:ProfileScreen`, `ProfileScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`, `../../shared/ui/ThemeContext`, `../../utils/clearDataOnLogout`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-screens-planviewerscreen-jsx"></span>`src/screens/PlanViewerScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/screens/PlanViewerScreen.jsx` |
| 2. **What it does** | Normalize API `focusColor` (hex or palette key) to accent tokens |
| 3. **Main components/functions** | `default:PlanViewerScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-screens-settings-forgotpassword-js"></span>`src/screens/settings/ForgotPassword.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/screens/settings/ForgotPassword.js` |
| 2. **What it does** | Source module `ForgotPassword` under screens/. |
| 3. **Main components/functions** | `default:ForgotPasswordScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/ForgotPasswordScreen.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-screens-settings-shared-usesettingschrome-js"></span>`src/screens/settings/shared/useSettingsChrome.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/screens/settings/shared/useSettingsChrome.js` |
| 2. **What it does** | CoachConnect settings surfaces: dark (#0A0A0F glass) or light (theme background + frosted cards) |
| 3. **Main components/functions** | `useSettingsChrome`, `ACCENT`, `PURPLE` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../../shared/ui/ThemeContext`, `../../../theme/colors`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-aboutappscreen-jsx"></span>`src/settings/screens/AboutAppScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/AboutAppScreen.jsx` |
| 2. **What it does** | Screen: AboutAppScreen. |
| 3. **Main components/functions** | `default:AboutAppScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-bugreportscreen-jsx"></span>`src/settings/screens/BugReportScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/BugReportScreen.jsx` |
| 2. **What it does** | Screen: BugReportScreen. |
| 3. **Main components/functions** | `default:BugReportScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../supportConfig`, `../../shared/services/baseUrl`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-settings-screens-changepasswordscreen-jsx"></span>`src/settings/screens/ChangePasswordScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/ChangePasswordScreen.jsx` |
| 2. **What it does** | Screen: ChangePasswordScreen. |
| 3. **Main components/functions** | `default:ChangePasswordScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-contactsupportscreen-jsx"></span>`src/settings/screens/ContactSupportScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/ContactSupportScreen.jsx` |
| 2. **What it does** | Screen: ContactSupportScreen. |
| 3. **Main components/functions** | `default:ContactSupportScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../supportConfig`, `../../shared/services/baseUrl`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-settings-screens-editprofilescreen-jsx"></span>`src/settings/screens/EditProfileScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/EditProfileScreen.jsx` |
| 2. **What it does** | Screen: EditProfileScreen. |
| 3. **Main components/functions** | `default:EditProfileScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-emailpreferencesscreen-jsx"></span>`src/settings/screens/EmailPreferencesScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/EmailPreferencesScreen.jsx` |
| 2. **What it does** | Screen: EmailPreferencesScreen. |
| 3. **Main components/functions** | `default:EmailPreferencesScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-helpfaqscreen-jsx"></span>`src/settings/screens/HelpFAQScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/HelpFAQScreen.jsx` |
| 2. **What it does** | Screen: HelpFAQScreen. |
| 3. **Main components/functions** | `default:HelpFAQScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../supportConfig`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-notificationsoverviewscreen-jsx"></span>`src/settings/screens/NotificationsOverviewScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/NotificationsOverviewScreen.jsx` |
| 2. **What it does** | Screen: NotificationsOverviewScreen. |
| 3. **Main components/functions** | `default:NotificationsOverviewScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../shared/services/notificationsService`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-privacypolicyscreen-jsx"></span>`src/settings/screens/PrivacyPolicyScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/PrivacyPolicyScreen.jsx` |
| 2. **What it does** | Screen: PrivacyPolicyScreen. |
| 3. **Main components/functions** | `default:PrivacyPolicyScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../supportConfig`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-settings-screens-resttimersettingsscreen-jsx"></span>`src/settings/screens/RestTimerSettingsScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/RestTimerSettingsScreen.jsx` |
| 2. **What it does** | Screen: RestTimerSettingsScreen. |
| 3. **Main components/functions** | `default:RestTimerSettingsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-termsofservicescreen-jsx"></span>`src/settings/screens/TermsOfServiceScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/TermsOfServiceScreen.jsx` |
| 2. **What it does** | Screen: TermsOfServiceScreen. |
| 3. **Main components/functions** | `default:TermsOfServiceScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../supportConfig`, `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-screens-workoutreminderssettingsscreen-jsx"></span>`src/settings/screens/WorkoutRemindersSettingsScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/screens/WorkoutRemindersSettingsScreen.jsx` |
| 2. **What it does** | Screen: WorkoutRemindersSettingsScreen. |
| 3. **Main components/functions** | `default:WorkoutRemindersSettingsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-settings-supportconfig-js"></span>`src/settings/supportConfig.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/settings/supportConfig.js` |
| 2. **What it does** | Source module `supportConfig` under settings/. |
| 3. **Main components/functions** | `getSupportEmail` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/settings/screens/BugReportScreen.jsx`, `src/settings/screens/ContactSupportScreen.jsx`, `src/settings/screens/HelpFAQScreen.jsx`, `src/settings/screens/PrivacyPolicyScreen.jsx`, `src/settings/screens/TermsOfServiceScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-assets-onboardingiconregistry-generated-js"></span>`src/shared/assets/onboardingIconRegistry.generated.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/assets/onboardingIconRegistry.generated.js` |
| 2. **What it does** | AUTO-GENERATED (but checked in) |
| 3. **Main components/functions** | `onboardingIconRegistry` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/shared/assets/onboardingIconRegistry.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-assets-onboardingiconregistry-js"></span>`src/shared/assets/onboardingIconRegistry.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/assets/onboardingIconRegistry.js` |
| 2. **What it does** | Manual aliases so app domain keys don't have to match filename keys |
| 3. **Main components/functions** | `normalizeOnboardingIconKey`, `onboardingIconRegistry`, `getOnboardingIconSource` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./onboardingIconRegistry.generated.js`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/OnboardingScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-addnotesfilesmodal-js"></span>`src/shared/components/AddNotesFilesModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/AddNotesFilesModal.js` |
| 2. **What it does** | Modal triggered by the bottom nav plus button |
| 3. **Main components/functions** | `default:AddNotesFilesModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../services/notesAndFilesService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-apploadingscreen-js"></span>`src/shared/components/AppLoadingScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/AppLoadingScreen.js` |
| 2. **What it does** | AppLoadingScreen — shared full-screen loading for the entire app (client and trainer)… |
| 3. **Main components/functions** | `default:AppLoadingScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js`, `src/app/ClientApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-avatar-js"></span>`src/shared/components/Avatar.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/Avatar.js` |
| 2. **What it does** | Reusable UI: Avatar. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-button-js"></span>`src/shared/components/Button.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/Button.js` |
| 2. **What it does** | Button Component @param {string} title - Button text @param {function} onPress - Press handler @param {string} variant - 'primary' \| 'secondary' \| 'outline' @pa… |
| 3. **Main components/functions** | `default:Button` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-card-js"></span>`src/shared/components/Card.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/Card.js` |
| 2. **What it does** | Card Component @param {ReactNode} children - Card content @param {function} onPress - Press handler (optional) @param {object} style - Additional styles |
| 3. **Main components/functions** | `default:Card` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-coachconnectheader-js"></span>`src/shared/components/CoachConnectHeader.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/CoachConnectHeader.js` |
| 2. **What it does** | Matches Settings screen pill gradient (dark pink → dark orange) |
| 3. **Main components/functions** | `default:CoachConnectHeader` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/FluidGlass`, `../../navigation/AppNavigationContext`, `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerProfileScreen.jsx`, `src/aiChat/screens/AIChatHomeScreen.jsx`, `src/aiChat/screens/AIChatScreen.jsx`, `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ProfileScreen.js`, `src/client/screens/SettingsScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx`, `src/profile/screens/ProfileScreen.jsx`, `src/settings/screens/BugReportScreen.jsx`, `src/settings/screens/ContactSupportScreen.jsx`, `src/settings/screens/HelpFAQScreen.jsx`, `src/settings/screens/PrivacyPolicyScreen.jsx`, `src/settings/screens/TermsOfServiceScreen.jsx`, `src/shared/components/DocumentEditorModal.js`, `src/shared/components/SpreadsheetEditorModal.js`, `src/trainer/screens/ClientRequestsScreen.js`, `src/trainer/screens/ConversationsListScreen.js`, `src/trainer/screens/TrainerMessagingScreen.js`, `src/trainer/screens/TrainerWeeklyReportScreen.jsx`, `src/workouts/screens/ActiveWorkoutScreen.jsx`, `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-createmodal-js"></span>`src/shared/components/CreateModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/CreateModal.js` |
| 2. **What it does** | Reusable UI: CreateModal. |
| 3. **Main components/functions** | `default:CreateModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./Modal`, `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-dailyquotecard-js"></span>`src/shared/components/DailyQuoteCard.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/DailyQuoteCard.js` |
| 2. **What it does** | Curated quotes from `dailyQuotesList |
| 3. **Main components/functions** | `default:DailyQuoteCard`, `DailyQuotePill` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`, `../data/dailyQuotesList.json`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-documenteditormodal-js"></span>`src/shared/components/DocumentEditorModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/DocumentEditorModal.js` |
| 2. **What it does** | Trainer document editor — create or edit a document |
| 3. **Main components/functions** | `default:DocumentEditorModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../services/notesAndFilesService`, `./ShareDocumentModal`, `./CoachConnectHeader`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-shared-components-documentviewermodal-js"></span>`src/shared/components/DocumentViewerModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/DocumentViewerModal.js` |
| 2. **What it does** | Read-only in-app viewer for trainer-created documents |
| 3. **Main components/functions** | `default:DocumentViewerModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../services/notesAndFilesService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/client/screens/ClientFilesScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-embedwebviewmodal-jsx"></span>`src/shared/components/EmbedWebViewModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/EmbedWebViewModal.jsx` |
| 2. **What it does** | Fullscreen embedded viewer (Office Online / Google gview) — keeps user in the app |
| 3. **Main components/functions** | `default:EmbedWebViewModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ClientFilesScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-fadeinup-jsx"></span>`src/shared/components/FadeInUp.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/FadeInUp.jsx` |
| 2. **What it does** | Tiny reusable entrance animation wrapper: fades in + lifts up a few px |
| 3. **Main components/functions** | `default:FadeInUp` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-filegallerygrid-jsx"></span>`src/shared/components/FileGalleryGrid.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/FileGalleryGrid.jsx` |
| 2. **What it does** | Shared file gallery UI — gradient-bordered cards in a 2-column grid… |
| 3. **Main components/functions** | `default:FileGalleryGrid` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../utils/fileFormatting`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/shared/components/TrainerSharedFilesModal.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-filesnotessectionpremium-jsx"></span>`src/shared/components/FilesNotesSectionPremium.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/FilesNotesSectionPremium.jsx` |
| 2. **What it does** | Reusable UI: FilesNotesSectionPremium. |
| 3. **Main components/functions** | `default:FilesNotesSectionPremium` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../utils/fileFormatting`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-gradientchatbubblesicon-jsx"></span>`src/shared/components/GradientChatBubblesIcon.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/GradientChatBubblesIcon.jsx` |
| 2. **What it does** | Chat bubbles masked with brand gradient (matches BottomNavBar / cg logo) |
| 3. **Main components/functions** | `default:GradientChatBubblesIcon` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/brandGradients`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js`, `src/trainer/screens/ConversationsListScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-gradientgemininavicon-jsx"></span>`src/shared/components/GradientGeminiNavIcon.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/GradientGeminiNavIcon.jsx` |
| 2. **What it does** | Google Gemini mark — filled with the same brand gradient as other tab icons (`BrandGradientIcon`) |
| 3. **Main components/functions** | `default:GradientGeminiNavIcon` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/brandGradients`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/navigation/BottomNavBar.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-holdtoconfirmmodal-jsx"></span>`src/shared/components/HoldToConfirmModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/HoldToConfirmModal.jsx` |
| 2. **What it does** | Destructive confirmation: user must press and hold until the progress bar fills… |
| 3. **Main components/functions** | `default:HoldToConfirmModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-input-js"></span>`src/shared/components/Input.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/Input.js` |
| 2. **What it does** | Input Component @param {string} label - Label text above input @param {string} value - Input value @param {function} onChangeText - Text change handler @param {… |
| 3. **Main components/functions** | `default:Input` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-loadingspinner-js"></span>`src/shared/components/LoadingSpinner.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/LoadingSpinner.js` |
| 2. **What it does** | LoadingSpinner Component - Now uses dot jumping loader @param {string} text - Text to display below loader |
| 3. **Main components/functions** | `default:LoadingSpinner` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`, `../../Loader`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-mediaviewermodal-jsx"></span>`src/shared/components/MediaViewerModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/MediaViewerModal.jsx` |
| 2. **What it does** | Reusable UI: MediaViewerModal. |
| 3. **Main components/functions** | `default:MediaViewerModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ClientFilesScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-modal-js"></span>`src/shared/components/Modal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/Modal.js` |
| 2. **What it does** | Modal Component @param {boolean} visible - Modal visibility @param {function} onClose - Close handler @param {ReactNode} children - Modal content @param {string… |
| 3. **Main components/functions** | `default:Modal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/shared/components/CreateModal.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-navicon-js"></span>`src/shared/components/NavIcon.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/NavIcon.js` |
| 2. **What it does** | Reusable UI: NavIcon. |
| 3. **Main components/functions** | `default:NavIcon` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`, `../../assets/icons/people.png`, `../../assets/house.png`, `../../assets/dumbbell (1).png`, `../../assets/icons/box.png`, `../../assets/icons/food.png`, `../../assets/icons/google_gemini.png`, `../../assets/icons/gpticon.png`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-onboarding-aioptinstep-jsx"></span>`src/shared/components/onboarding/AIOptInStep.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/onboarding/AIOptInStep.jsx` |
| 2. **What it does** | Reusable UI: AIOptInStep. |
| 3. **Main components/functions** | `AIOptInStep` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./onboardingAiDeps`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/OnboardingScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-onboarding-gradientcard-jsx"></span>`src/shared/components/onboarding/GradientCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/onboarding/GradientCard.jsx` |
| 2. **What it does** | Darken gradient colors by 10% when selected |
| 3. **Main components/functions** | `default:GradientCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-onboarding-onboardingaideps-jsx"></span>`src/shared/components/onboarding/onboardingAiDeps.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/onboarding/onboardingAiDeps.jsx` |
| 2. **What it does** | Shared onboarding tokens + primary CTA only |
| 3. **Main components/functions** | `getOnboardingUiTokens`, `OnboardingPrimaryButton`, `ONBOARDING_CTA_GRADIENT`, `ONBOARDING_BRAND_GRADIENT`, `TRAINER_ONBOARDING_GRADIENT`, `ONBOARDING_ACCENT`, `ONBOARDING_ACCENT_SOFT` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/OnboardingScreen.js`, `src/shared/components/onboarding/AIOptInStep.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-onboarding-onboardingprogress-jsx"></span>`src/shared/components/onboarding/OnboardingProgress.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/onboarding/OnboardingProgress.jsx` |
| 2. **What it does** | Reusable UI: OnboardingProgress. |
| 3. **Main components/functions** | `default:OnboardingProgress` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-pdfviewermodal-js"></span>`src/shared/components/PdfViewerModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/PdfViewerModal.js` |
| 2. **What it does** | Reusable UI: PdfViewerModal. |
| 3. **Main components/functions** | `default:PdfViewerModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ClientFilesScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-progresschart-js"></span>`src/shared/components/ProgressChart.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/ProgressChart.js` |
| 2. **What it does** | Progress Chart Component |
| 3. **Main components/functions** | `default:ProgressChart` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-removetrainersheet-js"></span>`src/shared/components/RemoveTrainerSheet.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/RemoveTrainerSheet.js` |
| 2. **What it does** | Bottom sheet for removing trainer/client relationship |
| 3. **Main components/functions** | `default:RemoveTrainerSheet` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-shared-components-reviewsubmitsheet-js"></span>`src/shared/components/ReviewSubmitSheet.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/ReviewSubmitSheet.js` |
| 2. **What it does** | Bottom sheet for submitting or editing a trainer review |
| 3. **Main components/functions** | `default:ReviewSubmitSheet` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerProfileScreen.jsx`, `src/app/ClientApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-shared-components-sessionmeetingcard-jsx"></span>`src/shared/components/SessionMeetingCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/SessionMeetingCard.jsx` |
| 2. **What it does** | Glass-style session card (matches PremiumWelcomeCard / app chrome — no rainbow frame)… |
| 3. **Main components/functions** | `SessionMeetingCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../lib/sessions`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/client/screens/MyDashboardScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-sharedocumentmodal-js"></span>`src/shared/components/ShareDocumentModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/ShareDocumentModal.js` |
| 2. **What it does** | Share trainer document with clients |
| 3. **Main components/functions** | `default:ShareDocumentModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../trainer/services/clientCRMService`, `../services/notesAndFilesService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js`, `src/shared/components/DocumentEditorModal.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-spreadsheeteditormodal-js"></span>`src/shared/components/SpreadsheetEditorModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/SpreadsheetEditorModal.js` |
| 2. **What it does** | Simple functions: SUM/AVG/COUNT/MIN/MAX over a range like A1:A10 |
| 3. **Main components/functions** | `default:SpreadsheetEditorModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../services/notesAndFilesService`, `./CoachConnectHeader`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-spreadsheetviewermodal-js"></span>`src/shared/components/SpreadsheetViewerModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/SpreadsheetViewerModal.js` |
| 2. **What it does** | In-app spreadsheet viewer for  |
| 3. **Main components/functions** | `default:SpreadsheetViewerModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../utils/xlsx`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ClientFilesScreen.jsx` |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-shared-components-trainersharedfilesmodal-jsx"></span>`src/shared/components/TrainerSharedFilesModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/TrainerSharedFilesModal.jsx` |
| 2. **What it does** | Full-screen list of trainer-shared files (same grid chrome as home preview) |
| 3. **Main components/functions** | `default:TrainerSharedFilesModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./FileGalleryGrid`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-weeklyreportpremium-jsx"></span>`src/shared/components/WeeklyReportPremium.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/WeeklyReportPremium.jsx` |
| 2. **What it does** | Per-trend accent: sleep sky, water cyan, movement green, coaching purple |
| 3. **Main components/functions** | `default:WeeklyReportPremium`, `parseDayNote`, `WeeklyReportScrollBody`, `WeeklyReportDetailModal`, `WR_COLORS` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/TrainerWeeklyReportScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-components-weightchart-js"></span>`src/shared/components/WeightChart.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/components/WeightChart.js` |
| 2. **What it does** | Weight Chart Component |
| 3. **Main components/functions** | `default:WeightChart` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-hooks-usechat-js"></span>`src/shared/hooks/useChat.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/hooks/useChat.js` |
| 2. **What it does** | Custom hook for managing chat state and OpenAI interactions @param {string} chatId - Optional chat ID to load an existing chat @returns {object} Chat state and … |
| 3. **Main components/functions** | `useChat` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../ai/services/chatService`, `../../ai/services/apiKeyService`, `../../ai/services/chatStorageService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/ChatScreen.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-shared-hooks-useexercises-js"></span>`src/shared/hooks/useExercises.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/hooks/useExercises.js` |
| 2. **What it does** | React hook useExercises for trainer/client data or UI behavior. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-icons-lucidelike-js"></span>`src/shared/icons/LucideLike.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/icons/LucideLike.js` |
| 2. **What it does** | Source module `LucideLike` under shared/. |
| 3. **Main components/functions** | `Home`, `Flame`, `Target`, `Activity`, `User`, `Trophy`, `Sparkles`, `Calendar` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-notifications-pushcopy-js"></span>`src/shared/notifications/pushCopy.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/notifications/pushCopy.js` |
| 2. **What it does** | detailLine e |
| 3. **Main components/functions** | `pickRandom`, `randomTrainerMessageTitle`, `randomClientRequestTitle`, `randomSessionUpdateClientBody`, `randomSessionCancelledClientBody`, `randomSessionResponseTrainerMessage`, `randomNotesSharedBody`, `randomSessionScheduledTitle` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../../config/pushNotificationCopy.json`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/services/trainerMessaging.js`, `src/hooks/use-sessions.js`, `src/shared/services/notesAndFilesService.js`, `src/trainer/services/pushSessionNotification.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-notifications-stripnotificationemoji-js"></span>`src/shared/notifications/stripNotificationEmoji.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/notifications/stripNotificationEmoji.js` |
| 2. **What it does** | Remove emoji / pictographs from push notification title and body (client) |
| 3. **Main components/functions** | `stripNotificationEmoji` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/shared/services/pushNotifyApi.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-services-baseurl-js"></span>`src/shared/services/baseUrl.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/services/baseUrl.js` |
| 2. **What it does** | In dev, Metro exposes the machine IP here |
| 3. **Main components/functions** | `getApiBase`, `getApiBaseCandidates` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/services/askServer.js`, `src/ai/services/openaiClient.js`, `src/ai/services/webSearch.js`, `src/aiChat/screens/AIChatScreen.jsx`, `src/auth/OnboardingScreen.js`, `src/nutrition/services/foodSearchProvider.js`, `src/settings/screens/BugReportScreen.jsx`, `src/settings/screens/ContactSupportScreen.jsx`, `src/shared/services/onboardingSync.js`, `src/shared/services/pushNotifyApi.js`, `src/trainer/services/pushSessionNotification.js`, `src/utils/restaurantNutrition.js`, `src/workouts/hooks/useYouTubeAPI.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-services-notesandfilesservice-js"></span>`src/shared/services/notesAndFilesService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/services/notesAndFilesService.js` |
| 2. **What it does** | Notes & Files — client and trainer can add notes, photos, videos, PDFs… |
| 3. **Main components/functions** | `uploadNotesFile`, `uploadNotesFileWithProgress`, `addNote`, `addFile`, `addSpreadsheetFile`, `markNotesAndFilesItemRead`, `deleteNotesAndFilesItem`, `getNotesAndFiles` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../utils/xlsx`, `../../app/config`, `./pushNotifyApi`, `../notifications/pushCopy`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/components/files/MyFilesSection.jsx`, `src/client/screens/ClientFilesScreen.jsx`, `src/shared/components/AddNotesFilesModal.js`, `src/shared/components/DocumentEditorModal.js`, `src/shared/components/DocumentViewerModal.js`, `src/shared/components/ShareDocumentModal.js`, `src/shared/components/SpreadsheetEditorModal.js`, `src/workouts/components/WorkoutPlanPdfViewerModal.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-shared-services-notificationsservice-js"></span>`src/shared/services/notificationsService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/services/notificationsService.js` |
| 2. **What it does** | @type {((data: Record<string, unknown>) => void) \| null} |
| 3. **Main components/functions** | `setNotificationTapHandler`, `flushInitialNotificationResponse`, `configureNotifications`, `getNotificationPermissionsAsync`, `requestNotificationPermissionsAsync`, `openSystemSettingsAsync`, `getNativeDevicePushTokenAsync`, `getExpoPushTokenAsync` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js`, `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/settings/screens/NotificationsOverviewScreen.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-shared-services-onboardingsync-js"></span>`src/shared/services/onboardingSync.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/services/onboardingSync.js` |
| 2. **What it does** | Queue a pending onboarding completion payload to sync later |
| 3. **Main components/functions** | `queuePendingOnboardingSync`, `flushPendingOnboardingSync` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js`, `src/auth/OnboardingScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-services-pushnotifyapi-js"></span>`src/shared/services/pushNotifyApi.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/services/pushNotifyApi.js` |
| 2. **What it does** | Remote push via Express POST /api/notifications/send (Expo path on server) |
| 3. **Main components/functions** | `postRemotePushNotify` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./baseUrl`, `../notifications/stripNotificationEmoji`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/services/trainerMessaging.js`, `src/app/ClientApp.js`, `src/client/screens/MyDashboardScreen.jsx`, `src/hooks/use-sessions.js`, `src/shared/services/notesAndFilesService.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-services-storage-js"></span>`src/shared/services/storage.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/services/storage.js` |
| 2. **What it does** | Upload a file to Firebase Storage |
| 3. **Main components/functions** | `uploadFile`, `getFileURL`, `deleteFile`, `listFiles`, `uploadProfileImage`, `uploadProgressPhoto`, `uploadFoodImage`, `uploadTrainerNote` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/AuthScreen.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-shared-ui-blurbackdropplate-jsx"></span>`src/shared/ui/BlurBackdropPlate.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/BlurBackdropPlate.jsx` |
| 2. **What it does** | Use blur as a backdrop only… |
| 3. **Main components/functions** | `default:BlurBackdropPlate` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerSearchScreen.js`, `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/auth/OnboardingScreen.js`, `src/client/screens/ProfileScreen.js`, `src/navigation/BottomNavBar.js`, `src/shared/ui/liquid/LiquidGlassCard.jsx`, `src/trainer/screens/ConversationsListScreen.js`, `src/trainer/screens/TrainerMessagingScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-brandgradients-js"></span>`src/shared/ui/brandGradients.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/brandGradients.js` |
| 2. **What it does** | Brand gradient aligned with cg logo (pink → purple → indigo), top → bottom |
| 3. **Main components/functions** | `BRAND_NAV_ICON_GRADIENT`, `BRAND_NAV_ICON_GRADIENT_LOCATIONS`, `BRAND_ICON_GRADIENT_START`, `BRAND_ICON_GRADIENT_END` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/navigation/BottomNavBar.js`, `src/shared/components/GradientChatBubblesIcon.jsx`, `src/shared/components/GradientGeminiNavIcon.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-fluidglass-examples-jsx"></span>`src/shared/ui/FluidGlass.examples.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/FluidGlass.examples.jsx` |
| 2. **What it does** | FluidGlass Usage Examples  This file shows how to convert existing UI components to use FluidGlass |
| 3. **Main components/functions** | `WorkoutCardExample`, `ModalExample`, `NutritionCardExample` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./FluidGlass`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-fluidglass-jsx"></span>`src/shared/ui/FluidGlass.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/FluidGlass.jsx` |
| 2. **What it does** | FluidGlass - True Liquid Glass Effect Component for React Native  Creates Apple iOS 26-style liquid glass effect using advanced styling Mimics refraction, light… |
| 3. **Main components/functions** | `default:FluidGlass` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/nutrition/components/MealCard.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/shared/components/CoachConnectHeader.js`, `src/shared/ui/FluidGlass.examples.jsx`, `src/workouts/screens/ActiveWorkoutScreen.jsx`, `src/workouts/screens/WorkoutHistoryScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-ios18theme-js"></span>`src/shared/ui/ios18Theme.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/ios18Theme.js` |
| 2. **What it does** | iOS 18 Design Language Theme |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-liquid-liquidbackground-jsx"></span>`src/shared/ui/liquid/LiquidBackground.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/liquid/LiquidBackground.jsx` |
| 2. **What it does** | Deep obsidian base with 3 mesh-like radial blurs in the corners |
| 3. **Main components/functions** | `default:LiquidBackground` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./liquidTokens`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/AuthScreen.js`, `src/auth/OnboardingScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-liquid-liquidbackgroundlight-jsx"></span>`src/shared/ui/liquid/LiquidBackgroundLight.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/liquid/LiquidBackgroundLight.jsx` |
| 2. **What it does** | Light-mode mesh background: soft paper base with subtle pastel corner blurs |
| 3. **Main components/functions** | `default:LiquidBackgroundLight` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/AuthScreen.js`, `src/auth/OnboardingScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-liquid-liquidglasscard-jsx"></span>`src/shared/ui/liquid/LiquidGlassCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/liquid/LiquidGlassCard.jsx` |
| 2. **What it does** | Custom "glass material": - background blur ~30 - semi-transparent surface - linear border brighter at top, fading to bottom - squircle geometry (continuous curv… |
| 3. **Main components/functions** | `default:LiquidGlassCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../BlurBackdropPlate`, `./liquidTokens`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/AuthScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-liquid-liquidgradientbutton-jsx"></span>`src/shared/ui/liquid/LiquidGradientButton.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/liquid/LiquidGradientButton.jsx` |
| 2. **What it does** | Source module `LiquidGradientButton` under shared/. |
| 3. **Main components/functions** | `default:LiquidGradientButton` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./liquidTokens`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/AuthScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-liquid-liquidiconhalo-jsx"></span>`src/shared/ui/liquid/LiquidIconHalo.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/liquid/LiquidIconHalo.jsx` |
| 2. **What it does** | Subtle glassmorphic halo behind an icon (quiet luxury): - no shadows - soft gradient + faint stroke - squircle geometry |
| 3. **Main components/functions** | `default:LiquidIconHalo` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./liquidTokens`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-liquid-liquidtokens-js"></span>`src/shared/ui/liquid/liquidTokens.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/liquid/liquidTokens.js` |
| 2. **What it does** | Accent palette (requested): hot pink, cyan, magenta, dark purple, light orange |
| 3. **Main components/functions** | `Liquid` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/auth/AuthScreen.js`, `src/shared/ui/liquid/LiquidBackground.jsx`, `src/shared/ui/liquid/LiquidGlassCard.jsx`, `src/shared/ui/liquid/LiquidGradientButton.jsx`, `src/shared/ui/liquid/LiquidIconHalo.jsx`, `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-theme-js"></span>`src/shared/ui/theme.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/theme.js` |
| 2. **What it does** | Theme configuration for React Native styling with Light and Dark mode support |
| 3. **Main components/functions** | `lightColors`, `darkColors`, `typography`, `spacing`, `borderRadius`, `fontSize`, `fontWeight`, `shadows` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/screens/DashboardScreen.js`, `src/shared/ui/ThemeContext.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-ui-themecontext-js"></span>`src/shared/ui/ThemeContext.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/ui/ThemeContext.js` |
| 2. **What it does** | Load saved theme preference |
| 3. **Main components/functions** | `ThemeProvider`, `useTheme` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./theme`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/components/ApiKeyInput.js`, `src/ai/screens/ChatListScreen.js`, `src/ai/screens/ChatScreen.js`, `src/ai/screens/TrainerSearchScreen.js`, `src/aiChat/screens/AIChatHomeScreen.jsx`, `src/aiChat/screens/AIChatScreen.jsx`, `src/app/ClientApp.js`, `src/app/RoleMigrationScreen.js`, `src/app/TrainerApp.js`, `src/auth/AuthScreen.js`, `src/auth/OnboardingScreen.js`, `src/client/components/TrainerProfileCardModal.jsx`, `src/client/screens/AccountProfileScreen.jsx`, `src/client/screens/DataStorageScreen.jsx`, `src/client/screens/GoalsTargetsScreen.jsx`, `src/client/screens/MyDashboardScreen.jsx`, `src/client/screens/NotificationsSettingsScreen.jsx`, `src/client/screens/PrivacySecurityScreen.jsx`, `src/client/screens/ProfileScreen.js`, `src/client/screens/SettingsScreen.js`, `src/client/screens/SocialSharingScreen.jsx`, `src/client/screens/UnitsMeasurementsScreen.jsx`, `src/navigation/BottomNavBar.js`, `src/navigation/CustomNavigationBar.jsx`, `src/nutrition/components/FoodItem.js`, `src/nutrition/components/MacroBar.js`, `src/nutrition/components/MealCard.js`, `src/nutrition/screens/BarcodeScannerScreen.js`, `src/nutrition/screens/FoodSearchScreen.js`, `src/nutrition/screens/MacroTrackerScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/screens/NutritionContainer.jsx`, `src/nutrition/screens/NutritionScreen.jsx`, `src/nutrition/screens/NutritionSettingsScreen.js`, `src/nutrition/screens/QuickAddNutrition.jsx`, `src/nutrition/screens/QuickAddScreen.jsx`, `src/profile/screens/ProfileScreen.jsx`, `src/screens/settings/ForgotPassword.js`, `src/screens/settings/shared/useSettingsChrome.js`, `src/settings/screens/AboutAppScreen.jsx`, `src/settings/screens/BugReportScreen.jsx`, `src/settings/screens/ChangePasswordScreen.jsx`, `src/settings/screens/ContactSupportScreen.jsx`, `src/settings/screens/EditProfileScreen.jsx`, `src/settings/screens/EmailPreferencesScreen.jsx`, `src/settings/screens/HelpFAQScreen.jsx`, `src/settings/screens/NotificationsOverviewScreen.jsx`, `src/settings/screens/PrivacyPolicyScreen.jsx`, `src/settings/screens/RestTimerSettingsScreen.jsx`, `src/settings/screens/TermsOfServiceScreen.jsx`, `src/settings/screens/WorkoutRemindersSettingsScreen.jsx`, `src/shared/components/Button.js`, `src/shared/components/Card.js`, `src/shared/components/CoachConnectHeader.js`, `src/shared/components/CreateModal.js`, `src/shared/components/DailyQuoteCard.js`, `src/shared/components/Input.js`, `src/shared/components/LoadingSpinner.js`, `src/shared/components/Modal.js`, `src/shared/components/NavIcon.js`, `src/shared/components/ProgressChart.js`, `src/shared/components/WeightChart.js`, `src/shared/components/onboarding/OnboardingProgress.jsx`, `src/trainer/components/StatsCards.jsx`, `src/trainer/components/TrainerMarketplaceModal.js`, `src/trainer/screens/AIWorkoutPlansScreen.js`, `src/trainer/screens/ClientRequestsScreen.js`, `src/trainer/screens/ConversationsListScreen.js`, `src/trainer/screens/ManualWorkoutPlanBuilderScreen.jsx`, `src/trainer/screens/PhotoGalleryScreen.js`, `src/trainer/screens/TrainerMessagingScreen.js`, `src/workouts/components/ExerciseCard.jsx`, `src/workouts/components/LoadingOverlay.jsx`, `src/workouts/screens/ActiveWorkoutScreen.jsx`, `src/workouts/screens/WorkoutHistoryScreen.jsx`, `src/workouts/screens/WorkoutPlanGeneratorScreenUI.js`, `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-utils-fileformatting-js"></span>`src/shared/utils/fileFormatting.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/utils/fileFormatting.js` |
| 2. **What it does** | UUID (8-4-4-4-12) or long hex-ish stems are usually not user-friendly |
| 3. **Main components/functions** | `formatFileSize`, `formatDateShort`, `getFileTypeFromItem`, `isProbablyGeneratedFilename`, `getFriendlyFileTitle` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/components/files/FileCard.jsx`, `src/client/components/files/MyFilesSection.jsx`, `src/client/components/files/NotesFromTrainerSection.jsx`, `src/client/components/files/TrainerSharedSection.jsx`, `src/client/screens/ClientFilesScreen.jsx`, `src/shared/components/FileGalleryGrid.jsx`, `src/shared/components/FilesNotesSectionPremium.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-utils-localday-js"></span>`src/shared/utils/getLocalDay.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/utils/getLocalDay.js` |
| 2. **What it does** | Local-day helpers (device timezone) |
| 3. **Main components/functions** | `getLocalDateKey`, `msUntilLocalMidnight`, `nextLocalMidnight` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js`, `src/client/screens/MyDashboardScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-utils-notesfileview-js"></span>`src/shared/utils/notesFileView.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/utils/notesFileView.js` |
| 2. **What it does** | Helpers for opening notes & files in-app (images, video, embeds) instead of Safari |
| 3. **Main components/functions** | `isImageFile`, `isVideoFile`, `isPdfFile`, `googleEmbedUrl`, `officeEmbedUrl`, `notesFileDedupeKey`, `getEmbedViewerUri` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/client/screens/ClientFilesScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-shared-utils-trainerprofilemedia-js"></span>`src/shared/utils/trainerProfileMedia.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/utils/trainerProfileMedia.js` |
| 2. **What it does** | Resolve a usable profile image URL from trainer / user shapes used across the app… |
| 3. **Main components/functions** | `trainerPhotoUri`, `resolveTrainerPhotoWithStorageFallback` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/ai/screens/TrainerSearchScreen.js`, `src/client/components/PremiumTrainerCard.jsx`, `src/marketplace/components/TrainerRequestConfirmModal.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-shared-utils-workoutdaylabels-js"></span>`src/shared/utils/workoutDayLabels.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/shared/utils/workoutDayLabels.js` |
| 2. **What it does** | Allowed labels for "today's workout" / workout day on the client dashboard |
| 3. **Main components/functions** | `isAllowedClientWorkoutDayLabel`, `normalizeWorkoutDayLabel`, `WORKOUT_DAY_EXAMPLES_SHORT` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/client/screens/MyDashboardScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-splash-splashscreen-jsx"></span>`src/splash/SplashScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/splash/SplashScreen.jsx` |
| 2. **What it does** | Make title visible immediately |
| 3. **Main components/functions** | `default:SplashScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-tests-workoutgeneration-test-js"></span>`src/tests/workoutGeneration.test.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/tests/workoutGeneration.test.js` |
| 2. **What it does** | Load  |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-theme-colors-js"></span>`src/theme/colors.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/theme/colors.js` |
| 2. **What it does** | RN shadow tokens (web box-shadow equivalents) |
| 3. **Main components/functions** | `colors`, `shadows`, `gradients` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/screens/settings/shared/useSettingsChrome.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-anatroxdashboard-jsx"></span>`src/trainer/components/AnatroxDashboard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/AnatroxDashboard.jsx` |
| 2. **What it does** | Reusable UI: AnatroxDashboard. |
| 3. **Main components/functions** | `default:AnatroxDashboard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-calendarview-jsx"></span>`src/trainer/components/CalendarView.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/CalendarView.jsx` |
| 2. **What it does** | Glass morphism effect |
| 3. **Main components/functions** | `default:CalendarView` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./WorkoutCard`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-clientheader-jsx"></span>`src/trainer/components/ClientHeader.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/ClientHeader.jsx` |
| 2. **What it does** | Glass morphism effect |
| 3. **Main components/functions** | `default:ClientHeader` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-headersection-jsx"></span>`src/trainer/components/HeaderSection.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/HeaderSection.jsx` |
| 2. **What it does** | Reusable UI: HeaderSection. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-messagesview-jsx"></span>`src/trainer/components/MessagesView.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/MessagesView.jsx` |
| 2. **What it does** | Load clients from trainer_clients subcollection |
| 3. **Main components/functions** | `default:MessagesView` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../services/clientCRMService`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-components-notesview-jsx"></span>`src/trainer/components/NotesView.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/NotesView.jsx` |
| 2. **What it does** | Request permission first |
| 3. **Main components/functions** | `default:NotesView` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-nutritionview-jsx"></span>`src/trainer/components/NutritionView.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/NutritionView.jsx` |
| 2. **What it does** | Fetch today's nutrition logs |
| 3. **Main components/functions** | `default:NutritionView` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../nutrition/daily-log/logFoodToFirestore`, `../../app/calculations`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-components-progressview-jsx"></span>`src/trainer/components/ProgressView.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/ProgressView.jsx` |
| 2. **What it does** | Fetch progress history - try both paths |
| 3. **Main components/functions** | `default:ProgressView` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../services/clientCRMService`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-components-quickactions-jsx"></span>`src/trainer/components/QuickActions.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/QuickActions.jsx` |
| 2. **What it does** | Glass morphism effect |
| 3. **Main components/functions** | `default:QuickActions` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-statscards-jsx"></span>`src/trainer/components/StatsCards.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/StatsCards.jsx` |
| 2. **What it does** | Glass morphism effect |
| 3. **Main components/functions** | `default:StatsCards` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-statsrow-jsx"></span>`src/trainer/components/StatsRow.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/StatsRow.jsx` |
| 2. **What it does** | Reusable UI: StatsRow. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-tabnavigation-jsx"></span>`src/trainer/components/TabNavigation.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/TabNavigation.jsx` |
| 2. **What it does** | Glass morphism effect |
| 3. **Main components/functions** | `default:TabNavigation` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-trainermarketplacemodal-js"></span>`src/trainer/components/TrainerMarketplaceModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/TrainerMarketplaceModal.js` |
| 2. **What it does** | Called after a successful reject (e |
| 3. **Main components/functions** | `default:TrainerMarketplaceModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../services/clientCRMService`, `../../ai/services/trainerMessaging`, `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/ClientRequestsScreen.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-components-trainerweeklyreportsection-jsx"></span>`src/trainer/components/TrainerWeeklyReportSection.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/TrainerWeeklyReportSection.jsx` |
| 2. **What it does** | Trainer dashboard: hero card under client chips → opens full weekly report for selected client |
| 3. **Main components/functions** | `default:TrainerWeeklyReportSection` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../client/components/WeeklyReportHeroCard`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-components-weekcalendar-jsx"></span>`src/trainer/components/WeekCalendar.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/WeekCalendar.jsx` |
| 2. **What it does** | Reusable UI: WeekCalendar. |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-components-workoutcard-jsx"></span>`src/trainer/components/WorkoutCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/components/WorkoutCard.jsx` |
| 2. **What it does** | Glass morphism effect |
| 3. **Main components/functions** | `default:WorkoutCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/components/CalendarView.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-data-manualexerciselibraryseed-js"></span>`src/trainer/data/manualExerciseLibrarySeed.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/data/manualExerciseLibrarySeed.js` |
| 2. **What it does** | Offline exercise library for the manual workout plan builder (search + autocomplete)… |
| 3. **Main components/functions** | `searchManualExerciseLibrary`, `MANUAL_EXERCISE_LIBRARY` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/services/manualWorkoutPlanService.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-hooks-usetrainerclients-js"></span>`src/trainer/hooks/useTrainerClients.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/hooks/useTrainerClients.js` |
| 2. **What it does** | CRM row explicitly marked inactive (legacy / soft paths) |
| 3. **Main components/functions** | `useTrainerClients` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../services/clientCRMService`, `../lib/trainerClientDisplayName`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js`, `src/hooks/use-sessions.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-hooks-usetrainerpendingrequests-js"></span>`src/trainer/hooks/useTrainerPendingRequests.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/hooks/useTrainerPendingRequests.js` |
| 2. **What it does** | Hook to fetch and refresh pending client requests for a trainer |
| 3. **Main components/functions** | `useTrainerPendingRequests` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../services/trainerPendingRequestsService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js`, `src/trainer/screens/ClientRequestsScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-lib-trainerclientdisplayname-js"></span>`src/trainer/crm/formatClientName.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/crm/formatClientName.js` |
| 2. **What it does** | Trainer roster: CRM `trainer_clients/… |
| 3. **Main components/functions** | `isGenericClientDisplayName`, `resolveTrainerClientDisplayName` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js`, `src/trainer/hooks/useTrainerClients.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-screens-aiworkoutplansscreen-js"></span>`src/trainer/screens/AIWorkoutPlansScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/AIWorkoutPlansScreen.js` |
| 2. **What it does** | Rules / index issues — show empty library, not raw Firestore text |
| 3. **Main components/functions** | `default:AIWorkoutPlansScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../services/manualWorkoutPlanService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-screens-clientdetailscreen-js"></span>`src/trainer/screens/ClientDetailScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/ClientDetailScreen.js` |
| 2. **What it does** | ClientDetailScreen is defined inline in src/app/TrainerApp |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-screens-clientrequestsscreen-js"></span>`src/trainer/screens/ClientRequestsScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/ClientRequestsScreen.js` |
| 2. **What it does** | Screen: ClientRequestsScreen. |
| 3. **Main components/functions** | `default:ClientRequestsScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../../shared/components/CoachConnectHeader`, `../hooks/useTrainerPendingRequests`, `../components/TrainerMarketplaceModal`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-screens-conversationslistscreen-js"></span>`src/trainer/screens/ConversationsListScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/ConversationsListScreen.js` |
| 2. **What it does** | Conversations List Screen — new glass UI, existing Firebase and navigation… |
| 3. **Main components/functions** | `default:ConversationsListScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/BlurBackdropPlate`, `../../shared/ui/ThemeContext`, `../../app/config`, `../../ai/services/conversationService`, `../services/clientCRMService`, `../../ai/services/trainerMessaging`, `../../shared/components/CoachConnectHeader`, `../../shared/components/GradientChatBubblesIcon`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-screens-manualworkoutplanbuilderscreen-jsx"></span>`src/trainer/screens/ManualWorkoutPlanBuilderScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/ManualWorkoutPlanBuilderScreen.jsx` |
| 2. **What it does** | Screen: ManualWorkoutPlanBuilderScreen. |
| 3. **Main components/functions** | `default:ManualWorkoutPlanBuilderScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../services/manualWorkoutPlanService`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-screens-photogalleryscreen-js"></span>`src/trainer/screens/PhotoGalleryScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/PhotoGalleryScreen.js` |
| 2. **What it does** | Pinch + double-tap zoom |
| 3. **Main components/functions** | `default:PhotoGalleryScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-trainer-screens-sessionformscreen-jsx"></span>`src/trainer/screens/SessionFormScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/SessionFormScreen.jsx` |
| 2. **What it does** | Dark pink + dark orange wheel chrome (Date / Time on session form) |
| 3. **Main components/functions** | `default:SessionFormScreen`, `SessionFormScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../hooks/use-sessions`, `../../client/components/MarketplaceHeroCard`, `../../components/WheelPicker`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-screens-sessionschedulerscreen-jsx"></span>`src/trainer/screens/SessionSchedulerScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/SessionSchedulerScreen.jsx` |
| 2. **What it does** | SessionSchedulerScreen — Schedule tab for trainer client detail… |
| 3. **Main components/functions** | `default:SessionSchedulerScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../services/scheduleService`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-screens-sessionschedulingscreen-jsx"></span>`src/trainer/screens/SessionSchedulingScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/SessionSchedulingScreen.jsx` |
| 2. **What it does** | Screen: SessionSchedulingScreen. |
| 3. **Main components/functions** | `default:SessionSchedulingScreen`, `SessionSchedulingScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../hooks/use-sessions`, `../../components/MonthCalendar`, `../../components/SessionCard`, `../../lib/sessions`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-screens-trainermessagingscreen-js"></span>`src/trainer/screens/TrainerMessagingScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/TrainerMessagingScreen.js` |
| 2. **What it does** | Trainer Messaging (Chat) Screen — new glass UI, existing Firebase and send flow |
| 3. **Main components/functions** | `default:TrainerMessagingScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/BlurBackdropPlate`, `../../shared/ui/ThemeContext`, `../../ai/services/trainerMessaging`, `../../app/config`, `../services/clientCRMService`, `../../shared/components/CoachConnectHeader`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-screens-trainersearchscreen-js"></span>`src/trainer/screens/TrainerSearchScreen.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/TrainerSearchScreen.js` |
| 2. **What it does** | Re-exports TrainerSearchScreen from ai module for consistency |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-screens-trainerweeklyreportscreen-jsx"></span>`src/trainer/screens/TrainerWeeklyReportScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/screens/TrainerWeeklyReportScreen.jsx` |
| 2. **What it does** | Same rim + checklist language as `MarketplaceHeroCard` (Find trainers) |
| 3. **Main components/functions** | `default:TrainerWeeklyReportScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/components/CoachConnectHeader`, `../../navigation/BottomNavBar`, `../../app/config`, `../../shared/components/WeeklyReportPremium`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-services-clientcrmservice-js"></span>`src/trainer/services/clientCRMService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/services/clientCRMService.js` |
| 2. **What it does** | Trainer client CRM — Firestore helpers… |
| 3. **Main components/functions** | `getClient`, `createOrUpdateClient`, `syncClientDataFromUsers`, `removeClient`, `getTrainerClients`, `updateClient`, `addProgress`, `getProgressHistory` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/shared/components/ShareDocumentModal.js`, `src/trainer/components/MessagesView.jsx`, `src/trainer/components/ProgressView.jsx`, `src/trainer/components/TrainerMarketplaceModal.js`, `src/trainer/hooks/useTrainerClients.js`, `src/trainer/screens/ConversationsListScreen.js`, `src/trainer/screens/TrainerMessagingScreen.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-trainer-services-manualworkoutplanservice-js"></span>`src/trainer/services/manualWorkoutPlanService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/services/manualWorkoutPlanService.js` |
| 2. **What it does** | Maps manual builder state → WorkoutPlanGeneratorScreen `structuredPlan |
| 3. **Main components/functions** | `newLocalId`, `parseDurationWeeks`, `buildStructuredWorkoutPlanFromManualDraft`, `buildTrainerPlanFirestorePayload`, `buildClientAssignedPlanDoc`, `createManualWorkoutPlan`, `updateManualWorkoutPlan`, `getManualWorkoutPlan`, `TRAINER_WORKOUT_PLANS_COLLECTION` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../data/manualExerciseLibrarySeed`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/AIWorkoutPlansScreen.js`, `src/trainer/screens/ManualWorkoutPlanBuilderScreen.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-services-pushsessionnotification-js"></span>`src/trainer/services/pushSessionNotification.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/services/pushSessionNotification.js` |
| 2. **What it does** | Send a session-scheduled push to the client from the trainer app… |
| 3. **Main components/functions** | `sendSessionScheduledPushToClient` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`, `../../shared/services/baseUrl`, `../../shared/notifications/pushCopy`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/hooks/use-sessions.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-trainer-services-scheduleservice-js"></span>`src/trainer/services/scheduleService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/services/scheduleService.js` |
| 2. **What it does** | Session schedule — trainer_clients/{trainerId}_{clientId}/schedule/{blockId} Trainer: full CRUD |
| 3. **Main components/functions** | `getScheduleDocId`, `getScheduleBlocks`, `subscribeScheduleBlocks`, `addScheduleBlock`, `updateScheduleBlock`, `deleteScheduleBlock` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/screens/SessionSchedulerScreen.jsx` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-trainer-services-trainerpendingrequestsservice-js"></span>`src/trainer/services/trainerPendingRequestsService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/trainer/services/trainerPendingRequestsService.js` |
| 2. **What it does** | Service to fetch pending client requests for a trainer |
| 3. **Main components/functions** | `getTrainerPendingRequests` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/trainer/hooks/useTrainerPendingRequests.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-utils-autologerror-js"></span>`src/utils/autoLogError.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/utils/autoLogError.js` |
| 2. **What it does** | Lightweight error logger used across the app… |
| 3. **Main components/functions** | `autoLogErrorSync`, `autoLogError` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/TrainerApp.js`, `src/nutrition/screens/MacroTrackerScreen.js`, `src/nutrition/screens/MealPlanHomeScreen.js`, `src/nutrition/daily-log/logFoodToFirestore.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-utils-datacachecleanup-js"></span>`src/utils/clearDataOnLogout.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/utils/clearDataOnLogout.js` |
| 2. **What it does** | Fix data leakage by clearing all cached data when user switches |
| 3. **Main components/functions** | `clearAllUserData`, `clearUserSpecificData`, `onUserSignOut`, `onUserSwitch` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/AuthGate.js`, `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/profile/screens/ProfileScreen.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-utils-migratetrainers-js"></span>`src/utils/migrateTrainers.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/utils/migrateTrainers.js` |
| 2. **What it does** | Migrates all users with role 'trainer' to the trainers collection This should be run once to migrate existing trainer accounts |
| 3. **Main components/functions** | `migrateTrainersToSeparateCollection`, `getTrainerCounts`, `runTrainerMigration` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-utils-restaurantnutrition-js"></span>`src/utils/restaurantNutrition.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/utils/restaurantNutrition.js` |
| 2. **What it does** | Restaurant nutrition: detect restaurant queries, build search query, and run full pipeline (Firestore cache + server extraction)… |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../app/config`, `../shared/services/baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-utils-xlsx-js"></span>`src/utils/xlsx.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/utils/xlsx.js` |
| 2. **What it does** | Default fallback for environments that don't match ` |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/shared/components/SpreadsheetViewerModal.js`, `src/shared/services/notesAndFilesService.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-utils-xlsx-native-js"></span>`src/utils/xlsx.native.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/utils/xlsx.native.js` |
| 2. **What it does** | Native (iOS/Android/Expo Go) shim for `xlsx` |
| 3. **Main components/functions** | `—` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-utils-xlsx-web-js"></span>`src/utils/xlsx.web.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/utils/xlsx.web.js` |
| 2. **What it does** | Web build uses the real `xlsx` package |
| 3. **Main components/functions** | `default:XLSX` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-editmodalform-rn-jsx"></span>`src/workouts/components/EditModalForm_RN.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/EditModalForm_RN.jsx` |
| 2. **What it does** | UI-only “nice” edit modal for Workout Plan builder fields |
| 3. **Main components/functions** | `EditModalForm` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-exercisecard-js"></span>`src/workouts/components/ExerciseCard.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ExerciseCard.js` |
| 2. **What it does** | Reusable UI: ExerciseCard. |
| 3. **Main components/functions** | `default:ExerciseCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/components/WorkoutExerciseLibraryTab.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-exercisecard-jsx"></span>`src/workouts/components/ExerciseCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ExerciseCard.jsx` |
| 2. **What it does** | Reusable UI: ExerciseCard. |
| 3. **Main components/functions** | `default:ExerciseCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-exercisecarousel-jsx"></span>`src/workouts/components/ExerciseCarousel.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ExerciseCarousel.jsx` |
| 2. **What it does** | Horizontal carousel for ExerciseCard-sized items |
| 3. **Main components/functions** | `ExerciseCarousel` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-exercisegrid-jsx"></span>`src/workouts/components/ExerciseGrid.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ExerciseGrid.jsx` |
| 2. **What it does** | Matches `ExerciseLibrarySection` horizontal padding (20 + 20) |
| 3. **Main components/functions** | `ExerciseGrid` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-exerciselibrarysection-jsx"></span>`src/workouts/components/ExerciseLibrarySection.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ExerciseLibrarySection.jsx` |
| 2. **What it does** | Section wrapper for Exercise Library (title + optional subtitle + children) |
| 3. **Main components/functions** | `ExerciseLibrarySection` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-exerciserow-jsx"></span>`src/workouts/components/ExerciseRow.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ExerciseRow.jsx` |
| 2. **What it does** | ExerciseRow Component  Displays a single exercise with inline editing for sets, reps, rest, and notes |
| 3. **Main components/functions** | `default:ExerciseRow` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/components/WorkoutDayCard.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-exercisesection-js"></span>`src/workouts/components/ExerciseSection.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ExerciseSection.js` |
| 2. **What it does** | Reusable UI: ExerciseSection. |
| 3. **Main components/functions** | `default:ExerciseSection` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/components/WorkoutExerciseLibraryTab.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-loadingoverlay-jsx"></span>`src/workouts/components/LoadingOverlay.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/LoadingOverlay.jsx` |
| 2. **What it does** | Loading Overlay Component  Shows progress messages during workout plan generation |
| 3. **Main components/functions** | `default:LoadingOverlay` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-planlimitbanner-jsx"></span>`src/workouts/components/PlanLimitBanner.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/PlanLimitBanner.jsx` |
| 2. **What it does** | Premium-looking plan generation limit banner… |
| 3. **Main components/functions** | `default:PlanLimitBanner` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-shortscard-js"></span>`src/workouts/components/ShortsCard.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/ShortsCard.js` |
| 2. **What it does** | Shorts thumbnails still use the same endpoint; we just present them 9:16 |
| 3. **Main components/functions** | `default:ShortsCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/components/WorkoutExerciseLibraryTab.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-videoplayermodal-jsx"></span>`src/workouts/components/VideoPlayerModal.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/VideoPlayerModal.jsx` |
| 2. **What it does** | YouTube IFrame API player (replaces raw WebView embed URLs — helps avoid Error 153)… |
| 3. **Main components/functions** | `YouTubeIframeExercisePlayer`, `VideoPlayerModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/components/WorkoutExerciseLibraryTab.jsx` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-workoutdaycard-jsx"></span>`src/workouts/components/WorkoutDayCard.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/WorkoutDayCard.jsx` |
| 2. **What it does** | WorkoutDayCard Component  Displays a workout plan as a day card with exercises |
| 3. **Main components/functions** | `default:WorkoutDayCard` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `./ExerciseRow`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-components-workoutexerciselibrarytab-jsx"></span>`src/workouts/components/WorkoutExerciseLibraryTab.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/WorkoutExerciseLibraryTab.jsx` |
| 2. **What it does** | Same as client `DashboardHeroCard` / Settings — dark pink → dark orange ring |
| 3. **Main components/functions** | `default:WorkoutExerciseLibraryTab` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../hooks/useYouTubeAPI`, `./VideoPlayerModal`, `./ExerciseSection`, `./ExerciseCard`, `./ShortsCard`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-workouts-components-workoutplanpdfviewermodal-js"></span>`src/workouts/components/WorkoutPlanPdfViewerModal.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/WorkoutPlanPdfViewerModal.js` |
| 2. **What it does** | In-app PDF viewer for generated workout plan |
| 3. **Main components/functions** | `default:WorkoutPlanPdfViewerModal` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/services/notesAndFilesService`, `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-workouts-components-youtubedebugoverlay-jsx"></span>`src/workouts/components/YouTubeDebugOverlay.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/components/YouTubeDebugOverlay.jsx` |
| 2. **What it does** | Reusable UI: YouTubeDebugOverlay. |
| 3. **Main components/functions** | `YouTubeDebugOverlay` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-workouts-hooks-useyoutubeapi-js"></span>`src/workouts/hooks/useYouTubeAPI.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/hooks/useYouTubeAPI.js` |
| 2. **What it does** | Reads YouTube Data API v3 key from Expo extra or env (supports legacy REACT_NATIVE_ name)… |
| 3. **Main components/functions** | `getYouTubeApiKey`, `getExerciseLibraryJourneyHint`, `useYouTubeAPI` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/services/baseUrl`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/components/WorkoutExerciseLibraryTab.jsx` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-workouts-screens-activeworkoutscreen-jsx"></span>`src/workouts/screens/ActiveWorkoutScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/screens/ActiveWorkoutScreen.jsx` |
| 2. **What it does** | Try to get active workout for user |
| 3. **Main components/functions** | `default:ActiveWorkoutScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../services/workoutService`, `../services/exerciseDB`, `../../shared/ui/FluidGlass`, `../../navigation/BottomNavBar`, `../../Loader`, `../../shared/components/CoachConnectHeader`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-workouts-screens-workout-js"></span>`src/workouts/screens/workout.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/screens/workout.js` |
| 2. **What it does** | Workout Plan Generator Screen Review onboarding data, allow edits, and generate personalized workout plan using DeepSeek API |
| 3. **Main components/functions** | `default:WorkoutPlanGeneratorScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../../shared/ui/liquid/liquidTokens`, `../../navigation/BottomNavBar`, `../../shared/components/CoachConnectHeader`, `./workoutPlanBuilderFieldEditBody`, `../services/workoutService`, `../../contexts/AIContext`, `../../ai/services/trainerMessaging`, `../services/workoutPlanPdfService`, `../components/WorkoutPlanPdfViewerModal`, `../../screens/PlanViewerScreen`, `../components/WorkoutExerciseLibraryTab`, `../components/EditModalForm_RN`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/app/TrainerApp.js`, `src/workouts/screens/WorkoutPlanGeneratorScreenUI.js` |
| 7. **Firebase/API** | Firebase/Firestore and HTTP or external API usage. |

### <span id="file-src-workouts-screens-workouthistoryscreen-jsx"></span>`src/workouts/screens/WorkoutHistoryScreen.jsx`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/screens/WorkoutHistoryScreen.jsx` |
| 2. **What it does** | Screen: WorkoutHistoryScreen. |
| 3. **Main components/functions** | `default:WorkoutHistoryScreen` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `../../app/config`, `../services/workoutService`, `../../shared/ui/FluidGlass`, `../../navigation/BottomNavBar`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-workouts-screens-workoutplanbuilderfieldeditbody-js"></span>`src/workouts/screens/workoutPlanBuilderFieldEditBody.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/screens/workoutPlanBuilderFieldEditBody.js` |
| 2. **What it does** | Inline edit bodies for workout plan builder rows — logic copied from WorkoutPlanGeneratorScreen |
| 3. **Main components/functions** | `default:WorkoutPlanBuilderFieldEditBody` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-screens-workoutplangeneratorscreenui-js"></span>`src/workouts/screens/WorkoutPlanGeneratorScreenUI.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/screens/WorkoutPlanGeneratorScreenUI.js` |
| 2. **What it does** | UI wrapper for workout plan generation |
| 3. **Main components/functions** | `default:WorkoutPlanGeneratorScreenUI` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../shared/ui/ThemeContext`, `./workout`; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | None detected by static scan (may still use globals). |

### <span id="file-src-workouts-services-claudeworkoutservice-js"></span>`src/workouts/services/claudeWorkoutService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/services/claudeWorkoutService.js` |
| 2. **What it does** | Claude Workout Service  Handles workout plan generation and regeneration via Claude API… |
| 3. **Main components/functions** | `generateWorkoutPlan`, `regenerateWorkoutPlan` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: —; packages/other: — |
| 6. **Where used (`src/` importers)** | — |
| 7. **Firebase/API** | HTTP `fetch`, env-based API, or third-party API usage. |

### <span id="file-src-workouts-services-workoutplanpdfservice-js"></span>`src/workouts/services/workoutPlanPdfService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/services/workoutPlanPdfService.js` |
| 2. **What it does** | Workout plan PDF: parse plan text, generate PDF (expo-print), save to Storage + Firestore |
| 3. **Main components/functions** | `parsePlanForPdf`, `stripEmojis`, `stripMarkdown`, `buildPdfHtml`, `generatePdfFile`, `uploadPdfToStorage`, `savePlanToFirestore`, `getWorkoutPlans` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

### <span id="file-src-workouts-services-workoutservice-js"></span>`src/workouts/services/workoutService.js`

| # | Detail |
|---|--------|
| 1. **Path** | `src/workouts/services/workoutService.js` |
| 2. **What it does** | Single doc path for current workout plan: users/{uid}/workoutPlan |
| 3. **Main components/functions** | `getCurrentWorkoutPlan`, `setCurrentWorkoutPlan`, `createWorkoutTemplate`, `fetchWorkoutTemplates`, `getWorkoutTemplate`, `startWorkout`, `getActiveWorkout`, `subscribeToActiveWorkout` |
| 4. **Key state/logic** | Local React state, effects, handlers, and/or pure helpers defined in this file (open in IDE for full detail). |
| 5. **Dependencies** | Relative: `../../app/config`; packages/other: — |
| 6. **Where used (`src/` importers)** | `src/app/ClientApp.js`, `src/client/screens/DashboardScreen.js`, `src/workouts/screens/ActiveWorkoutScreen.jsx`, `src/workouts/screens/WorkoutHistoryScreen.jsx`, `src/workouts/screens/workout.js` |
| 7. **Firebase/API** | Firebase (Auth, Firestore, or related SDK calls). |

---

## <span id="appendix-a-static-assets-json--images"></span>Appendix A: static assets (JSON / images) under `src/`

These files are not source modules; they are bundled as static assets (Lottie animations, images, quote lists). Any `.tsx?$` file may `require()` them.

```
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Ai Workouts.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Gemini_Generated_Image_6lz96c6lz96c6lz9-removebg-preview.png.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Happy SUN.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/IMG_2562.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lottie red.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/AI loading.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Ai  brain board.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Artificial intelligence digital technology (1).json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/CERTIFICATE FOR GRADUATION.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Calendar.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Call Center Support Lottie Animation.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Circle Shape Morphing animation.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Clock.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Cloud robotics abstract.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Data protection isometric.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Dollar Coins Chest.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Fast food.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Fitness.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Food squeeze_With Burger and hot dog.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Goal Achieved.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Healthy food for diet & fitness.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/HeartBeat | Medical.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Login.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Microsoft Designer (4).json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Minimal Style 3D Sphere Animation (1).json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Profile Password Unlock.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Question.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Sparkles Loop Loader ai.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/Yoga Dog.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/boxer lottie.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/fitness (1).json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/food around the city.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/glass water.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/loading.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/maintenance cyber security.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/service.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Lotties for Anatrox/sleep.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Run Hamster... run.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/Stressed Employee At Work.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/ai_workouts.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/client-icon-transparent.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/client-icon.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/dumbbell (1).png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/house.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Call.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Calories.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Carbs.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Check in.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Circle Shape Morphing animation.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Fats.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Find Trainers.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Gemini_Generated_Image_6lz96c6lz96c6lz9-removebg-preview.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Gemini_Generated_Image_6lz96c6lz96c6lz9-removebg-preview.png.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Illustration-of-Google-icon-on-transparent-background-PNG.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Message.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Advanced.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Age.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Beginner.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Bodyweight Only.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Full Gym.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Google-Gemini-Logo-Transparent.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Intermediate.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Other.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Pull Up Bar.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/Resistance Bands.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/dumbbells.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/female.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/male.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/New Icons/prefer not to say.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Progress.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Protein.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Schedule.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Steps.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/This Week.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/Weight1.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/achievement.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/analysis.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/apple-logo.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/artificial-intelligence.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/barbell.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/bedroom.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/box.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/burger.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/color-palette.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/conversation.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/delete.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/destination.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/dumbbell (1).png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/dumbbell.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/electrocardiogram.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/exercise.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/flames.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/food.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/google_gemini.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/gpticon.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/gym-1.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/height.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/home.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/icons8-watermelon-slice-94.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/leg-curl.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/measure-tape.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/messages.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/mic.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/microphone.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/nutrition.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/patient.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/people.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/picture.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/post-it.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/privacy.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/profile.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/scales.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/scan.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/settings.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/shoulder.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/target.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/trainer.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/water-bottle.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/weight.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/weightlifting-competition.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons/workout.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/icons8-watermelon-slice-94.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/logo.jpg
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/Exercise for diet or health.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/Guy talking to Robot _ AI Help.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/Minimal_Style_3D_Sphere_Animation__1_.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/certifications.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/equipment step.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/equipment.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/experience-timeline.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/fitness-experience.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/fitness-goal.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/icons8-gemini-ai-16.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/injuries.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/invite-code.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/personal-info.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/philosophy.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/rates.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/role-selection.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/specialties.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/trainer-code.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/training-frequency.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/lottie/welcome-robot.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Advanced.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Age.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Beginner.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Bodyweight Only.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Full Gym.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Intermediate.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Other.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Pull Up Bar.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/Resistance Bands.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/certifications.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/dumbbells.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/equipment.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/experience-timeline.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/female.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/fitness-experience.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/fitness-goal.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/height.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/injuries.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/invite-code.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/male.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/personal-info.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/philosophy.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/prefer not to say.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/rates.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/role-selection.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/scales.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/specialties.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/trainer-code.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/onboarding-consolidated/training-frequency.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/sad reaction.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/trainer-icon-transparent.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/assets/trainer-icon.png
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/shared/assets/Happy SUN.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/shared/assets/Walking steps.json
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th Project- Coach Connect Mobile App/src/shared/data/dailyQuotesList.json
```
