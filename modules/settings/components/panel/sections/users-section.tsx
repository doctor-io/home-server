import {
    InfoBanner,
    SectionDivider,
    UserRow,
} from "@/modules/settings/components/panel/controls";

export function UsersSection({ username }: { username: string }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="User Accounts" />
      <InfoBanner text="Homeio is currently single-user only. Multi-user access is planned next." />
      <UserRow
        name={username}
        role="Admin"
        email="Local account"
        lastActive="Current session"
        avatarColor="oklch(0.55 0.15 190)"
      />
      <button
        disabled
        className="self-start mt-1 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-80"
      >
        <span>Add User</span>
        <span className="rounded-[var(--radius)] bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Soon
        </span>
      </button>
    </div>
  );
}
