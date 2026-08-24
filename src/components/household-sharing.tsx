"use client";

import { useState } from "react";
import {
  createHouseholdInvitation,
  removeHouseholdMember,
  revokeHouseholdInvitation,
} from "@/app/actions";

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

export function HouseholdSharing({
  householdId,
  householdName,
  role,
  members,
  invitations,
  generatedInviteToken,
  joined,
  shareError,
}: Props) {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const generatedLink = generatedInviteToken ? `${siteUrl}/invite/${generatedInviteToken}` : null;
  const isOwner = role === "owner";

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopiedLink(link);
    window.setTimeout(() => setCopiedLink(null), 1800);
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
      {shareError && <div className="form-alert error">{shareError}</div>}

      {generatedLink && (
        <div className="invite-success-card">
          <div className="invite-success-icon" aria-hidden="true">✓</div>
          <div className="invite-success-copy">
            <p className="eyebrow">INVITE READY</p>
            <h3>Share this private link</h3>
            <p>Send it only to the person you invited. The link expires after seven days and their account email must match the invitation.</p>
          </div>
          <div className="invite-link-row">
            <input readOnly value={generatedLink} aria-label="Household invitation link" />
            <button className="primary" type="button" onClick={() => copyLink(generatedLink)}>
              {copiedLink === generatedLink ? "Copied" : "Copy link"}
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
                    ) : (
                      <span className="member-access-label">{memberIsOwner ? "Manages household" : "Shared access"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isOwner && members.length > 1 && (
            <p className="member-help-text">Removing someone only removes their access to this household. It does not delete their Cook&apos;s Kitchen account.</p>
          )}
        </div>

        <div className="household-panel invite-panel">
          {isOwner ? (
            <>
              <div className="invite-panel-top">
                <div className="invite-panel-icon" aria-hidden="true">+</div>
                <div>
                  <p className="eyebrow">INVITE SOMEONE</p>
                  <h3>Add a household member</h3>
                </div>
              </div>
              <p className="panel-copy">Invite a family member by email, then send them the secure link. Once they join, they&apos;ll see the same recipes and weekly plan you do.</p>

              <form className="invite-form" action={createHouseholdInvitation}>
                <input type="hidden" name="household_id" value={householdId} />
                <label>
                  Email address
                  <input name="email" type="email" placeholder="family@example.com" autoComplete="email" required />
                </label>
                <button className="primary" type="submit">Create invite</button>
              </form>
              <p className="invite-fine-print">Private invite links expire after 7 days.</p>

              {invitations.length > 0 && (
                <div className="pending-invites">
                  <div className="pending-heading">
                    <p className="eyebrow">PENDING INVITES</p>
                    <span>{invitations.length}</span>
                  </div>
                  {invitations.map((invite) => {
                    const link = `${siteUrl}/invite/${invite.token}`;
                    return (
                      <div className="pending-invite-row" key={invite.id}>
                        <div className="pending-invite-copy">
                          <strong>{invite.invited_email}</strong>
                          <span>Expires {formatShortDate(invite.expires_at)}</span>
                        </div>
                        <div className="inline-actions">
                          <button className="secondary compact" type="button" onClick={() => copyLink(link)}>
                            {copiedLink === link ? "Copied" : "Copy link"}
                          </button>
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
              <div className="member-info-icon" aria-hidden="true">CK</div>
              <p className="eyebrow">SHARED HOUSEHOLD</p>
              <h3>You&apos;re part of {householdName}</h3>
              <p>You can add recipes and update the weekly dinner plan. Invitations and household membership are managed by the owner.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
