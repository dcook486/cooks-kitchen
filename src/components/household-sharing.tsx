"use client";

import { useState } from "react";
import {
  createHouseholdInvitation,
  leaveHousehold,
  removeHouseholdMember,
  revokeHouseholdInvitation,
  transferHouseholdOwnership,
} from "@/app/household-actions";
import { SubmitButton } from "@/components/submit-button";

type Member = {
  user_id: string;
  role: string;
  created_at: string;
  display_name: string;
};

type Invitation = {
  id: string;
  invited_email: string | null;
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
  householdNotice: string | null;
};

const siteUrl = "https://cooks-kitchen.vercel.app";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function householdInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CK";
}

function noticeCopy(value: string | null) {
  if (value === "invite-revoked") return "Invitation revoked. That private link can no longer be used.";
  if (value === "member-removed") return "Household member removed. Their Cook's Kitchen account was not deleted.";
  if (value === "ownership-transferred") return "Ownership transferred. You are now a household member and the new owner manages membership and invitations.";
  return null;
}

function emailInviteHref(email: string, householdName: string, link: string) {
  const subject = `Join ${householdName} on Cook's Kitchen`;
  const body = [
    `You've been invited to join ${householdName} on Cook's Kitchen.`,
    "",
    "Open this private invitation:",
    link,
    "",
    "This invitation expires after 7 days.",
  ].join("\n");

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function HouseholdSharing({
  householdId,
  householdName,
  role,
  members,
  invitations,
  generatedInviteToken,
  joined,
  shareError,
  householdNotice,
}: Props) {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const generatedInvite = generatedInviteToken
    ? invitations.find((invite) => invite.token === generatedInviteToken) ?? null
    : null;
  const generatedLink = generatedInviteToken ? `${siteUrl}/invite/${generatedInviteToken}` : null;
  const isOwner = role === "owner";
  const notice = noticeCopy(householdNotice);

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopiedLink(link);
    window.setTimeout(() => setCopiedLink(null), 1800);
  }

  async function shareInvite(invite: Invitation) {
    const link = `${siteUrl}/invite/${invite.token}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${householdName} on Cook's Kitchen`,
          text: `Use this one-time link to join ${householdName} on Cook's Kitchen.`,
          url: link,
        });
        return;
      } catch {
        // The user can cancel the native share sheet; fall back to copying the link.
      }
    }
    await copyLink(link);
  }

  return (
    <section className="household-section">
      <div className="household-hero">
        <div className="household-identity">
          <div className="household-mark" aria-hidden="true">{householdInitials(householdName)}</div>
          <div>
            <p className="eyebrow">COOK TOGETHER</p>
            <h2>{householdName}</h2>
            <p className="section-subcopy">One shared recipe collection and one weekly dinner plan for everyone at home.</p>
          </div>
        </div>
        <div className="household-hero-meta">
          <span className="role-pill">{isOwner ? "Household owner" : "Household member"}</span>
          <span className="household-count"><strong>{members.length}</strong> {members.length === 1 ? "member" : "members"}</span>
        </div>
      </div>

      {joined && <div className="form-alert success">You joined {householdName}. Your recipes and weekly plan are now shared.</div>}
      {notice && <div className="form-alert success">{notice}</div>}
      {shareError && <div className="form-alert error">{shareError}</div>}

      {generatedLink && generatedInvite && (
        <div className="invite-success-card invite-success-card-enhanced">
          <div className="invite-success-icon" aria-hidden="true">✓</div>
          <div className="invite-success-copy">
            <p className="eyebrow">INVITE LINK READY</p>
            <h3>Send this link to one person</h3>
            <p>The first person who accepts it will join {householdName}. The link works once and expires after 7 days.</p>
          </div>

          <div className="invite-link-row">
            <input readOnly value={generatedLink} aria-label="Household invitation link" />
            <button className="secondary" type="button" onClick={() => copyLink(generatedLink)}>
              {copiedLink === generatedLink ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="invite-actions-row">
            <button className="primary" type="button" onClick={() => shareInvite(generatedInvite)}>
              Share invite
            </button>
          </div>
        </div>
      )}

      <div className="household-grid">
        <div className="household-panel members-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR KITCHEN</p>
              <h3>Household members</h3>
            </div>
            <span>Shared access</span>
          </div>

          <div className="member-list">
            {members.map((member) => {
              const memberIsOwner = member.role === "owner";
              return (
                <div className="member-row" key={member.user_id}>
                  <div className="member-avatar" aria-hidden="true">{member.display_name.slice(0, 1).toUpperCase()}</div>
                  <div className="member-copy">
                    <div className="member-name-line">
                      <strong>{member.display_name}</strong>
                      <span className={`member-badge ${memberIsOwner ? "owner" : "member"}`}>
                        {memberIsOwner ? "Owner" : "Member"}
                      </span>
                    </div>
                    <span>Joined {formatDate(member.created_at)}</span>
                  </div>

                  <div className="member-actions">
                    {isOwner && !memberIsOwner ? (
                      <>
                        <form
                          action={transferHouseholdOwnership}
                          onSubmit={(event) => {
                            const confirmed = window.confirm(
                              `Make ${member.display_name} the owner of ${householdName}? You will become a regular household member.`,
                            );
                            if (!confirmed) event.preventDefault();
                          }}
                        >
                          <input type="hidden" name="household_id" value={householdId} />
                          <input type="hidden" name="user_id" value={member.user_id} />
                          <button className="transfer-owner-button" type="submit">Make owner</button>
                        </form>
                        <form
                          action={removeHouseholdMember}
                          onSubmit={(event) => {
                            const confirmed = window.confirm(
                              `Remove ${member.display_name} from ${householdName}? They will immediately lose access to the shared recipes and meal plan.`,
                            );
                            if (!confirmed) event.preventDefault();
                          }}
                        >
                          <input type="hidden" name="household_id" value={householdId} />
                          <input type="hidden" name="user_id" value={member.user_id} />
                          <button className="remove-member-button" type="submit">Remove</button>
                        </form>
                      </>
                    ) : (
                      <span className="member-access-label">{memberIsOwner ? "Manages household" : "Shared access"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isOwner && members.length > 1 && (
            <div className="member-help-text ownership-help">
              <strong>Need someone else to take over?</strong>
              <span>Transfer ownership first. You&apos;ll stay in the kitchen as a regular member and can leave afterward if you want.</span>
            </div>
          )}
        </div>

        <div className="household-panel invite-panel">
          {isOwner ? (
            <>
              <div className="invite-panel-top">
                <div className="invite-panel-icon" aria-hidden="true">+</div>
                <div>
                  <p className="eyebrow">INVITE SOMEONE</p>
                  <h3>Share your kitchen</h3>
                </div>
              </div>
              <p className="panel-copy">Create a private link, then text or share it with the person you want to add. They can sign in or create an account after opening it.</p>

              <form className="invite-form" action={createHouseholdInvitation}>
                <input type="hidden" name="household_id" value={householdId} />
                <SubmitButton className="primary wide" pendingLabel="Creating link…">Create invite link</SubmitButton>
              </form>
              <p className="invite-fine-print">Each link works once and expires after 7 days. Creating a new share link replaces the previous unused one.</p>

              {invitations.length > 0 && (
                <div className="pending-invites">
                  <div className="pending-heading">
                    <p className="eyebrow">PENDING INVITES</p>
                    <span>{invitations.length}</span>
                  </div>
                  {invitations.map((invite) => {
                    const link = `${siteUrl}/invite/${invite.token}`;
                    const inviteLabel = invite.invited_email ?? "One-time share link";
                    return (
                      <div className="pending-invite-row" key={invite.id}>
                        <div className="pending-invite-copy">
                          <strong>{inviteLabel}</strong>
                          <span>Expires {formatShortDate(invite.expires_at)}</span>
                        </div>
                        <div className="inline-actions pending-invite-actions">
                          {invite.invited_email && (
                            <a className="secondary compact link-button" href={emailInviteHref(invite.invited_email, householdName, link)}>Email</a>
                          )}
                          <button className="secondary compact" type="button" onClick={() => shareInvite(invite)}>
                            Share
                          </button>
                          <button className="secondary compact" type="button" onClick={() => copyLink(link)}>
                            {copiedLink === link ? "Copied" : "Copy"}
                          </button>
                          <form
                            action={revokeHouseholdInvitation}
                            onSubmit={(event) => {
                              if (!window.confirm(`Revoke this invitation? Its current link will stop working.`)) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="id" value={invite.id} />
                            <input type="hidden" name="household_id" value={householdId} />
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
            <div className="member-info-card member-lifecycle-card">
              <div className="member-info-icon" aria-hidden="true">CK</div>
              <p className="eyebrow">SHARED HOUSEHOLD</p>
              <h3>You&apos;re part of {householdName}</h3>
              <p>You can add recipes and update the dinner plan. Invitations, member removal, and ownership are managed by the household owner.</p>

              <div className="leave-household-box">
                <div>
                  <strong>Leave this household</strong>
                  <span>Your account stays active, but you&apos;ll lose access to this household&apos;s recipes and plans.</span>
                </div>
                <form
                  action={leaveHousehold}
                  onSubmit={(event) => {
                    if (!window.confirm(`Leave ${householdName}? You will immediately lose access to its shared recipes and meal plan.`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="household_id" value={householdId} />
                  <button className="remove-member-button" type="submit">Leave household</button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
