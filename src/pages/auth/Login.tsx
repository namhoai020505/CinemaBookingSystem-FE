import Header from '../../layouts/user/Header';
import Footer from '../../layouts/user/Footer';
import {
  AuthFeedback,
  AuthSubmitButton,
  AuthTabs,
  GoogleLoginButton,
} from './components/AuthShell';
import { CredentialsStep } from './components/CredentialsStep';
import { ForgotPasswordStep } from './components/ForgotPasswordStep';
import { ResetPasswordStep } from './components/ResetPasswordStep';
import { VerifyEmailStep } from './components/VerifyEmailStep';
import { useLoginController } from './useLoginController';

export default function Login() {
  const controller = useLoginController();

  return (
    <div className="flex min-h-screen flex-col bg-[#1E293B]">
      <Header />

      <main className="flex min-h-[80vh] items-start justify-center bg-[#1E293B] px-4 pb-12 pt-32">
        <div className="w-full max-w-md">
          <AuthTabs authMode={controller.authMode} onSwitchMode={controller.switchMode} />

          <div className="rounded-b-lg border-x border-b border-gray-700 bg-transparent p-6">
            <form onSubmit={controller.handleSubmit} className="flex flex-col gap-4">
              <AuthFeedback
                successMessage={controller.successMessage}
                error={controller.error}
              />

              {controller.isVerifyStep ? (
                <VerifyEmailStep controller={controller} />
              ) : controller.isResetPasswordStep ? (
                <ResetPasswordStep controller={controller} />
              ) : controller.isForgotMode ? (
                <ForgotPasswordStep controller={controller} />
              ) : (
                <CredentialsStep controller={controller} />
              )}

              <AuthSubmitButton
                isLoading={controller.isLoading}
                isVerifyStep={controller.isVerifyStep}
                isResetPasswordStep={controller.isResetPasswordStep}
                isForgotMode={controller.isForgotMode}
                isLoginMode={controller.isLoginMode}
              />

              {!controller.isVerifyStep &&
              !controller.isResetPasswordStep &&
              !controller.isForgotMode ? (
                <GoogleLoginButton
                  onSuccess={controller.handleGoogleLogin}
                  isLoading={controller.isLoading}
                />
              ) : null}
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
