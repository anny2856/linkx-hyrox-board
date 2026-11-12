-- Run once in a NEW Supabase project SQL Editor. No anonymous writes.
begin;
create table if not exists public.hyrox_races (
 id text primary key, names text not null check(length(trim(names)) between 1 and 100),
 division text not null, day date not null, time time(0) not null, lane text not null default '',
 status text not null default 'waiting' check(status in ('waiting','racing','finished')),
 sample integer not null default 0 check(sample in (0,1)),version integer not null default 1,
 updated_at timestamptz not null default now(),updated_by text
);
create table if not exists public.hyrox_settings(key text primary key,value text not null);
alter table public.hyrox_races enable row level security;
alter table public.hyrox_settings enable row level security;
revoke all on public.hyrox_races,public.hyrox_settings from anon,authenticated;
grant all on public.hyrox_races,public.hyrox_settings to service_role;
create or replace function public.hyrox_version() returns trigger language plpgsql set search_path = '' as $$
begin new.version:=old.version+1; new.updated_at:=now(); return new; end; $$;
drop trigger if exists hyrox_version on public.hyrox_races;
create trigger hyrox_version before update on public.hyrox_races for each row execute function public.hyrox_version();
-- The seed guard prevents rerunning this file from resurrecting deleted entries.
insert into public.hyrox_races(id,day,time,names,division,lane,status,sample)
select v.* from (values
('entry-01',date '2026-11-13',time '08:50', '이주용', 'MEN OPEN SINGLE', '', 'waiting', 0),
('entry-02',date '2026-11-13',time '09:00', '조정현', 'MEN OPEN SINGLE', '', 'waiting', 0),
('entry-03',date '2026-11-13',time '11:50', '이현탁, 박민규', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-04',date '2026-11-13',time '12:00', '김재환, 탁현식', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-05',date '2026-11-13',time '12:10', '윤형석, 이진호', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-06',date '2026-11-13',time '12:30', '유성수, 구민혁', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-07',date '2026-11-13',time '12:30', '최홍석, 이민호', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-08',date '2026-11-13',time '12:50', '김사현, 정광열', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-09',date '2026-11-13',time '13:10', '김종근, 김동휘', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-10',date '2026-11-13',time '13:40', '강홍구, 이용', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-11',date '2026-11-13',time '15:20', '김해인, 변미정', 'DOUBLES WOMEN OPEN', '', 'waiting', 0),
('entry-12',date '2026-11-13',time '15:50', '동윤정, 김나리', 'DOUBLES WOMEN OPEN', '', 'waiting', 0),
('entry-13',date '2026-11-13',time '18:00', '김승지, 최용훈', 'DOUBLES MIXED', '', 'waiting', 0),
('entry-14',date '2026-11-14',time '10:40', '이상윤', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-15',date '2026-11-14',time '12:30', '오창규', 'MEN OPEN SINGLE', '', 'waiting', 0),
('entry-16',date '2026-11-14',time '13:10', '박혜문', 'DOUBLES WOMEN PRO', '', 'waiting', 0),
('entry-17',date '2026-11-14',time '15:00', '김민지, 이현규', 'DOUBLES MIXED', '', 'waiting', 0),
('entry-18',date '2026-11-14',time '15:30', '김현준', 'DOUBLES MIXED', '', 'waiting', 0),
('entry-19',date '2026-11-14',time '15:40', '김상현, 차진희', 'DOUBLES MIXED', '', 'waiting', 0),
('entry-20',date '2026-11-14',time '16:20', '이주용, 강태연', 'DOUBLES MIXED', '', 'waiting', 0),
('entry-21',date '2026-11-14',time '18:20', '권재호, 주선규', 'DOUBLES MEN PRO', '', 'waiting', 0),
('entry-22',date '2026-11-14',time '20:20', '이정철', 'MEN PRO SINGLE', '', 'waiting', 0),
('entry-23',date '2026-11-15',time '07:20', '차진희, 박현미', 'DOUBLES WOMEN OPEN', '', 'waiting', 0),
('entry-24',date '2026-11-15',time '09:50', '이나경, 장유니스', 'DOUBLES WOMEN OPEN', '', 'waiting', 0),
('entry-25',date '2026-11-15',time '10:00', '김린, 이소영', 'DOUBLES WOMEN OPEN', '', 'waiting', 0),
('entry-26',date '2026-11-15',time '14:30', '조정훈, 민규원', 'DOUBLES MEN OPEN', '', 'waiting', 0),
('entry-27',date '2026-11-15',time '20:20', '박혜문', 'RELAY WOMEN', '', 'waiting', 0)
) as v(id,day,time,names,division,lane,status,sample)
where not exists(select 1 from public.hyrox_settings where key='seeded')
on conflict(id) do nothing;
insert into public.hyrox_settings(key,value) values('seeded','1') on conflict(key) do nothing;
commit;
