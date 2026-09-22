// Route shim: the "reset password" entry point in auth just forwards to the real forgot-password UI.
// Flow: navigator asks for ResetPasswordScreen → this re-exports the settings-side ForgotPasswordFlow component.
// Exists so auth and settings can both link to the same flow without duplicating the screen.

// Note: no logic lives here on purpose. Edit the actual form/steps in the ForgotPasswordFlow component.
export { default } from '../settings/screens/ForgotPasswordFlow';
