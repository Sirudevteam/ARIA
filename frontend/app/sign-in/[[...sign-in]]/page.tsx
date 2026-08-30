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
            card: "bg-[#080f1e]/95 border border-sky-500/20 shadow-2xl shadow-sky-500/10 text-white rounded-xl backdrop-blur-xl",
            headerTitle: "text-white font-bold tracking-tight text-lg",
            headerSubtitle: "text-slate-400 text-xs",
            socialButtonsBlockButton: "bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white",
            formButtonPrimary: "bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25",
            formFieldLabel: "text-slate-300 text-xs font-medium",
            formFieldInput: "bg-slate-900/80 border-slate-700 text-white focus:border-sky-500 focus:ring-sky-500",
            footerActionLink: "text-sky-400 hover:text-sky-300",
            identityPreviewText: "text-slate-200",
            identityPreviewEditButton: "text-sky-400 hover:text-sky-300",
          },
        }}
      />
    </AuthShell>
  );
}
