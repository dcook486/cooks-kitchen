import { updateHouseholdIdentity } from "@/app/household/actions";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  householdId: string;
  householdName: string;
  kitchenName: string;
  tagline: string | null;
  isOwner: boolean;
  saved: boolean;
  error: string | null;
};

export function HouseholdIdentitySettings({
  householdId,
  householdName,
  kitchenName,
  tagline,
  isOwner,
  saved,
  error,
}: Props) {
  return (
    <section className="household-identity-settings">
      <div className="identity-settings-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h2>Kitchen identity</h2>
          <p>Give the shared household a name and decide what everyone sees at the top of Cook&apos;s Kitchen.</p>
        </div>
        <div className="identity-preview" aria-label="Kitchen title preview">
          <span>{householdName.toUpperCase()}</span>
          <strong>{kitchenName}</strong>
          {tagline && <small>{tagline}</small>}
        </div>
      </div>

      {saved && <div className="form-alert success">Kitchen settings saved.</div>}
      {error && <div className="form-alert error">{error}</div>}

      {isOwner ? (
        <form className="identity-settings-form" action={updateHouseholdIdentity}>
          <input type="hidden" name="household_id" value={householdId} />
          <div className="form-grid two">
            <label>
              Household name
              <input name="household_name" defaultValue={householdName} maxLength={80} required />
              <span className="field-help">Used for sharing and the small label above your kitchen name.</span>
            </label>
            <label>
              Kitchen name
              <input name="kitchen_name" defaultValue={kitchenName} maxLength={80} placeholder="Cook's Kitchen" required />
              <span className="field-help">The large title on the main screen. Make it yours.</span>
            </label>
          </div>

          <label>
            Tagline <span className="optional-label">Optional</span>
            <input name="tagline" defaultValue={tagline ?? ""} maxLength={120} placeholder="What’s cooking this week?" />
            <span className="field-help">Shown under the kitchen name. Leave it blank for a cleaner header.</span>
          </label>

          <div className="identity-settings-footer">
            <p>These settings are shared with everyone in the household.</p>
            <SubmitButton className="primary" pendingLabel="Saving…">Save kitchen settings</SubmitButton>
          </div>
        </form>
      ) : (
        <div className="identity-readonly-note">The household owner manages these shared kitchen settings.</div>
      )}
    </section>
  );
}
