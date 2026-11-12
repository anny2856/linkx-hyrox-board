-- Existing schedules, statuses and users are preserved. Run on the existing project.
begin;
alter table public.hyrox_races add column if not exists finish_time text;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='hyrox_races_finish_time_check' and conrelid='public.hyrox_races'::regclass) then
  alter table public.hyrox_races add constraint hyrox_races_finish_time_check
   check(finish_time is null or (finish_time ~ '^[0-9]{2}:[0-5][0-9]:[0-5][0-9]$' and finish_time <> '00:00:00'));
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
