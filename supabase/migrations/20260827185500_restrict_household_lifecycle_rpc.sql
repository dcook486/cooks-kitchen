revoke execute on function public.leave_household(uuid) from anon;
revoke execute on function public.transfer_household_ownership(uuid, uuid) from anon;

grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.transfer_household_ownership(uuid, uuid) to authenticated;
