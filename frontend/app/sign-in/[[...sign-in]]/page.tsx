import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "bg-white/95 border border-slate-200 shadow-xl shadow-slate-200/50 text-slate-900 rounded-2xl backdrop-blur-xl",
            headerTitle: "text-slate-900 font-bold tracking-tight text-lg",
            headerSubtitle: "text-slate-500 text-xs",
            socialButtonsBlockButton: "bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700",
            formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20",
            formFieldLabel: "text-slate-700 text-xs font-medium",
            formFieldInput: "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600 focus:ring-blue-600",
            footerActionLink: "text-blue-600 hover:text-blue-700",
            identityPreviewText: "text-slate-700",
            identityPreviewEditButton: "text-blue-600 hover:text-blue-700",
          },
        }}
      />
    </AuthShell>
  );
}
