"use client";

import { useState } from "react";
import { createHouseholdInvitation, revokeHouseholdInvitation } from "@/app/actions";

type Member = {
  user_id: string;
  role: string;
  created_at: string;
  display_name: string;
};

type Invitation = {
  id: string;
  invited_email: string;
  token: string;
  expires_at: string;
  created_at: string;
};

type Props = {
  householdId: string;
  householdName: string;
  role: string;
  members: Member[];
  invitations: Invitation[];
  generatedInviteToken: string | null;
  joined: boolean;
  shareError: string | null;
};

const siteUrl = "https://cooks-kitchen.vercel.app";

export function HouseholdSharing({ householdId, householdName, role, members, invitations, generatedInviteToken, joined, shareError }: Props) {
  const [copied, setCopied] = useState(false);
  const generatedLink = generatedInviteToken ? `${siteUrl}/invite/${generatedInviteToken}` : null;

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">COOK TOGETHER</p>
          <h2>Household</h2>
          <p className="section-subcopy">Everyone here shares the same recipe bank and weekly dinner plan.</p>
        </div>
        <span className="role-pill">{role === "owner" ? "Household owner" : "Household member"}</span>
      </div>

      {joined && <div className="form-alert success">You joined {householdName}. Your recipes and weekly plan are now shared.</div>}
      {shareError && <div className="form-alert error">{shareError}</div>}

      {generatedLink && (
        <div className="invite-success-card">
          <div>
            <p className="eyebrow">INVITE READY</p>
            <h3>Share this private link</h3>
            <p>Send it only to the person you invited. It expires after seven days and their account email must match the invitation.</p>
          </div>
          <div className="invite-link-row">
            <input readOnly value={generatedLink} aria-label="Household invitation link" />
            <button className="primary" type="button" onClick={() => copyLink(generatedLink)}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        </div>
      )}

      <div className="household-grid">
        <div className="household-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">MEMBERS</p><h3>{householdName}</h3></div>
            <span>{members.length} {members.length === 1 ? "person" : "people"}</span>
          </div>
          <div className="member-list">
            {members.map((member) => (
              <div className="member-row" key={member.user_id}>
                <div className="member-avatar">{member.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="member-copy">
                  <strong>{member.display_name}</strong>
                  <span>{member.role === "owner" ? "Owner" : "Member"}</span>
                </div>
                <span className="member-since">Joined {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(member.created_at))}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="household-panel">
          {role === "owner" ? (
            <>
              <div className="panel-heading">
                <div><p className="eyebrow">INVITE SOMEONE</p><h3>Add a household member</h3></div>
              </div>
              <p className="panel-copy">Enter their email, then copy the secure invite link and send it to them. Branded invitation emails can come later.</p>
              <form className="invite-form" action={createHouseholdInvitation}>
                <input type="hidden" name="household_id" value={householdId} />
                <label>Email address<input name="email" type="email" placeholder="family@example.com" required /></label>
                <button className="primary" type="submit">Create invite</button>
              </form>

              {invitations.length > 0 && (
                <div className="pending-invites">
                  <p className="eyebrow">PENDING INVITES</p>
                  {invitations.map((invite) => {
                    const link = `${siteUrl}/invite/${invite.token}`;
                    return (
                      <div className="pending-invite-row" key={invite.id}>
                        <div><strong>{invite.invited_email}</strong><span>Expires {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(invite.expires_at))}</span></div>
                        <div className="inline-actions">
                          <button className="secondary compact" type="button" onClick={() => copyLink(link)}>Copy link</button>
                          <form action={revokeHouseholdInvitation}>
                            <input type="hidden" name="id" value={invite.id} />
                            <button className="danger-link" type="submit">Revoke</button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="member-info-card">
              <div>👥</div>
              <h3>You&apos;re sharing this kitchen</h3>
              <p>Members can add recipes and update the weekly dinner plan. Household invitations are managed by the owner.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
