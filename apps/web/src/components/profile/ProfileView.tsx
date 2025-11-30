import { useState } from "react";
import { useAuth, type ProfileData } from "../../context/AuthContext";
import { DataSourcesCard } from "./DataSourcesCard";
import { ProfilingCard } from "./ProfilingCard";
import { ProfileEditCard } from "./ProfileEditCard";
import { ProfileDisplayCard } from "./ProfileDisplayCard";

type ProfileStep = "sources" | "profiling" | "review" | "complete";

export function ProfileView() {
  const { profile, setProfile } = useAuth();
  const [step, setStep] = useState<ProfileStep>(profile ? "complete" : "sources");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const handleSourcesComplete = (sources: string[]) => {
    setSelectedSources(sources);
    setStep("profiling");
  };

  const handleProfilingComplete = (newProfile: ProfileData) => {
    setProfile(newProfile);
    setStep("review");
  };

  const handleReviewComplete = () => {
    setStep("complete");
  };

  const handleReProfile = () => {
    setStep("sources");
  };

  if (step === "complete" && profile) {
    return (
      <div className="profile-view">
        <ProfileDisplayCard profile={profile} onReProfile={handleReProfile} />
      </div>
    );
  }

  return (
    <div className="profile-view">
      <div className="profile-steps">
        <div className={`step-indicator ${step === "sources" ? "active" : step !== "sources" ? "done" : ""}`}>
          1. Data Sources
        </div>
        <div className={`step-indicator ${step === "profiling" ? "active" : step === "review" || step === "complete" ? "done" : ""}`}>
          2. Profiling
        </div>
        <div className={`step-indicator ${step === "review" ? "active" : step === "complete" ? "done" : ""}`}>
          3. Review
        </div>
      </div>

      {step === "sources" && (
        <DataSourcesCard
          selected={selectedSources}
          onComplete={handleSourcesComplete}
        />
      )}

      {step === "profiling" && (
        <ProfilingCard
          sources={selectedSources}
          onComplete={handleProfilingComplete}
          onBack={() => setStep("sources")}
        />
      )}

      {step === "review" && profile && (
        <ProfileEditCard
          profile={profile}
          onSave={handleReviewComplete}
          onReProfile={() => setStep("sources")}
        />
      )}
    </div>
  );
}

