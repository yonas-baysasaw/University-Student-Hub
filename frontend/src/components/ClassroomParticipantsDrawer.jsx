import ClassroomMembersSidebar from './ClassroomMembersSidebar';

/**
 * Slide-over roster drawer shared by Discussion, Announcements, and Resources.
 */
export default function ClassroomParticipantsDrawer({
  open,
  onClose,
  chatId,
  chatName,
  members,
  creator,
  admins,
  membersError,
  invitationCode,
  user,
  viewerCanManageRoster,
  viewerCanManageClassroom,
  viewerIsClassroomCreator,
  onRefreshMeta,
  onOpenEditClassroom,
  onRequestLeave,
  leaveBusy = false,
  showEditClassroomButton = true,
  showLeaveButton = true,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200]">
      <button
        type="button"
        aria-label="Close participants drawer"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fade-in-up absolute right-0 top-0 h-full w-[min(92vw,24rem)] max-w-md overflow-y-auto bg-slate-50 p-3 shadow-2xl dark:bg-slate-950/95 sm:w-[min(86vw,22rem)] md:p-4 lg:w-[min(400px,32vw)]">
        <ClassroomMembersSidebar
          chatId={chatId}
          chatName={chatName}
          members={members}
          creator={creator}
          admins={admins}
          membersError={membersError}
          user={user}
          viewerCanManageRoster={viewerCanManageRoster}
          invitationCode={invitationCode}
          viewerCanManageClassroom={viewerCanManageClassroom}
          viewerIsClassroomCreator={viewerIsClassroomCreator}
          onOpenEditClassroom={onOpenEditClassroom}
          onRequestLeave={onRequestLeave}
          leaveBusy={leaveBusy}
          onRefreshMeta={onRefreshMeta}
          onCloseDrawer={onClose}
          showEditClassroomButton={showEditClassroomButton}
          showLeaveButton={showLeaveButton}
          className="h-full min-h-0 rounded-2xl border-slate-200/90 shadow-md dark:border-slate-700"
        />
      </div>
    </div>
  );
}
