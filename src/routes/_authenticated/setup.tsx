import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Globe2, Languages, Loader2, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

import { COUNTRIES, LANGUAGE_GROUPS } from "@/lib/creator-options";
import { updateProfile } from "@/lib/profile.functions";
import { SearchableSelect } from "@/components/searchable-select";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Set up your account — Smart GPT" },
      { name: "description", content: "Choose your country and preferred language so Smart GPT creates content for your audience." },
      { property: "og:title", content: "Set up your account — Smart GPT" },
      { property: "og:description", content: "Choose your country and preferred language to personalise every AI tool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const navigate = useNavigate();
  const saveFn = useServerFn(updateProfile);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { country, language, onboarded: true } }),
    onSuccess: () => {
      toast.success("Preferences saved");
      navigate({ to: "/" });
    },
    onError: () => toast.error("Could not save your preferences"),
  });

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center px-5 py-12">
      <div className="rounded-3xl border border-border/70 p-6 sm:p-8" style={{ background: "var(--gradient-card)" }}>
        <div className="mb-6 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <span className={step === 1 ? "text-primary" : ""}>Step 1 · Country</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className={step === 2 ? "text-primary" : ""}>Step 2 · Language</span>
        </div>

        {step === 1 ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Globe2 className="h-6 w-6 text-primary" />
              <h1 className="font-display text-2xl font-bold">Select your country</h1>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              We use this to match your content style with your audience.
            </p>
            <SearchableSelect
              value={country}
              onChange={setCountry}
              options={COUNTRIES}
              placeholder="Choose a country"
              searchPlaceholder="Search countries…"
            />
            <button
              onClick={() => setStep(2)}
              disabled={!country}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Languages className="h-6 w-6 text-primary" />
              <h1 className="font-display text-2xl font-bold">Select your language</h1>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              All AI content will be written in this language. You can change it anytime in your profile.
            </p>
            <SearchableSelect
              value={language}
              onChange={setLanguage}
              groups={LANGUAGE_GROUPS}
              placeholder="Choose a language"
              searchPlaceholder="Search languages…"
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded-xl border border-border px-5 py-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={!language || save.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Finish setup
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
