create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.users_profile(user_id, display_name, preferred_locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'en');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
