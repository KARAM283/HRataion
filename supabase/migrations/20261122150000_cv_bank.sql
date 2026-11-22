-- CV Bank: candidate pipelines and secure CV metadata
create table if not exists public.candidate_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  position text,
  pipeline_id uuid references public.candidate_pipelines(id) on delete set null,
  cv_path text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.candidate_pipelines enable row level security;
alter table public.candidates enable row level security;

drop policy if exists "HR admin manages candidate pipelines" on public.candidate_pipelines;
create policy "HR admin manages candidate pipelines"
on public.candidate_pipelines for all to authenticated
using (auth.uid() = '7191e13f-f726-4636-8668-8d5d4ea87cfc'::uuid)
with check (auth.uid() = '7191e13f-f726-4636-8668-8d5d4ea87cfc'::uuid);

drop policy if exists "HR admin manages candidates" on public.candidates;
create policy "HR admin manages candidates"
on public.candidates for all to authenticated
using (auth.uid() = '7191e13f-f726-4636-8668-8d5d4ea87cfc'::uuid)
with check (auth.uid() = '7191e13f-f726-4636-8668-8d5d4ea87cfc'::uuid);

grant select, insert, update, delete on public.candidate_pipelines to authenticated;
grant select, insert, update, delete on public.candidates to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-documents', 'hr-documents', false, 15728640, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain'
])
on conflict (id) do update set public = false, file_size_limit = 15728640;
