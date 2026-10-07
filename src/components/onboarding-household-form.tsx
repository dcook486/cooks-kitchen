"use client";

import { useEffect, useMemo, useState } from "react";
import { createHousehold } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  defaultHouseholdName: string;
  defaultKitchenName: string;
};

const commonTimeZones = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
];

function readableTimeZone(value: string) {
  return value.replaceAll("_", " ").replaceAll("/", " · ");
}

export function OnboardingHouseholdForm({ defaultHouseholdName, defaultKitchenName }: Props) {
  const [timeZone, setTimeZone] = useState("America/Chicago");

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setTimeZone(detected);
  }, []);

  const timeZones = useMemo(() => {
    if (commonTimeZones.some((entry) => entry.value === timeZone)) return commonTimeZones;
    return [{ value: timeZone, label: readableTimeZone(timeZone) }, ...commonTimeZones];
  }, [timeZone]);

  return (
    <form className="stack-form onboarding-identity-form" action={createHousehold}>
      <label>
        Kitchen name
        <input name="kitchen_name" defaultValue={defaultKitchenName} placeholder="The Smith Kitchen" required maxLength={80} />
        <span className="onboarding-field-help">This is the name you&apos;ll see at the top of Cook&apos;s Kitchen.</span>
      </label>

      <label>
        Household name
        <input name="name" defaultValue={defaultHouseholdName} placeholder="Smith Family" required maxLength={80} />
        <span className="onboarding-field-help">Used for household sharing and invitations.</span>
      </label>

      <label>
        Time zone
        <select name="timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
          {timeZones.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label} · {entry.value}</option>
          ))}
        </select>
        <span className="onboarding-field-help">Detected from this device. You can adjust it if needed.</span>
      </label>

      <SubmitButton className="primary wide onboarding-primary" pendingLabel="Creating your kitchen…">Create my kitchen →</SubmitButton>
    </form>
  );
}
