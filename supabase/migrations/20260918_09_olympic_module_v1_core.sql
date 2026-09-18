-- AI-CLO OLYMPIC V1 core schema. Applied to production Supabase on 2026-09-18.
create table if not exists public.olympic_subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  short_name text,
  description text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.olympic_sections (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.olympic_subjects(id) on delete cascade,
  name text not null,
  description text,
  order_index integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.olympic_topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.olympic_subjects(id) on delete cascade,
  section_id uuid references public.olympic_sections(id) on delete set null,
  title text not null,
  description text,
  importance text not null default 'required' check (importance in ('required','recommended','advanced')),
  status text not null default 'draft' check (status in ('draft','editing','approved','teaching')),
  order_index integer not null default 0,
  is_visible boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.olympic_lessons (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.olympic_subjects(id) on delete cascade,
  topic_id uuid references public.olympic_topics(id) on delete set null,
  title text not null,
  summary text,
  content_tex text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  order_index integer not null default 0,
  is_visible boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.olympic_teacher_subjects (
  subject_id uuid not null references public.olympic_subjects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  can_manage_contents boolean not null default true,
  can_manage_lessons boolean not null default true,
  can_manage_problems boolean not null default true,
  can_manage_tests boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (subject_id, profile_id)
);

create or replace function public.olympic_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and p.role='admin');
$$;

create or replace function public.olympic_can_manage_subject(p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.olympic_is_admin() or exists (
    select 1 from public.olympic_teacher_subjects ots
    join public.profiles p on p.id=ots.profile_id
    where ots.subject_id=p_subject_id and ots.profile_id=auth.uid()
      and p.is_active=true and p.role in ('teacher','lecturer','giangvien','admin')
  );
$$;

create or replace function public.olympic_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at=now(); return new; end;
$$;

drop trigger if exists olympic_subjects_touch on public.olympic_subjects;
create trigger olympic_subjects_touch before update on public.olympic_subjects for each row execute function public.olympic_touch_updated_at();
drop trigger if exists olympic_sections_touch on public.olympic_sections;
create trigger olympic_sections_touch before update on public.olympic_sections for each row execute function public.olympic_touch_updated_at();
drop trigger if exists olympic_topics_touch on public.olympic_topics;
create trigger olympic_topics_touch before update on public.olympic_topics for each row execute function public.olympic_touch_updated_at();
drop trigger if exists olympic_lessons_touch on public.olympic_lessons;
create trigger olympic_lessons_touch before update on public.olympic_lessons for each row execute function public.olympic_touch_updated_at();

alter table public.olympic_subjects enable row level security;
alter table public.olympic_sections enable row level security;
alter table public.olympic_topics enable row level security;
alter table public.olympic_lessons enable row level security;
alter table public.olympic_teacher_subjects enable row level security;

drop policy if exists olympic_subjects_select on public.olympic_subjects;
create policy olympic_subjects_select on public.olympic_subjects for select to authenticated using (is_active or public.olympic_is_admin());
drop policy if exists olympic_subjects_admin_write on public.olympic_subjects;
create policy olympic_subjects_admin_write on public.olympic_subjects for all to authenticated using (public.olympic_is_admin()) with check (public.olympic_is_admin());

drop policy if exists olympic_sections_select on public.olympic_sections;
create policy olympic_sections_select on public.olympic_sections for select to authenticated using (is_visible or public.olympic_can_manage_subject(subject_id));
drop policy if exists olympic_sections_write on public.olympic_sections;
create policy olympic_sections_write on public.olympic_sections for all to authenticated using (public.olympic_can_manage_subject(subject_id)) with check (public.olympic_can_manage_subject(subject_id));

drop policy if exists olympic_topics_select on public.olympic_topics;
create policy olympic_topics_select on public.olympic_topics for select to authenticated using (is_visible or public.olympic_can_manage_subject(subject_id));
drop policy if exists olympic_topics_write on public.olympic_topics;
create policy olympic_topics_write on public.olympic_topics for all to authenticated using (public.olympic_can_manage_subject(subject_id)) with check (public.olympic_can_manage_subject(subject_id));

drop policy if exists olympic_lessons_select on public.olympic_lessons;
create policy olympic_lessons_select on public.olympic_lessons for select to authenticated using ((is_visible and status='published') or public.olympic_can_manage_subject(subject_id));
drop policy if exists olympic_lessons_write on public.olympic_lessons;
create policy olympic_lessons_write on public.olympic_lessons for all to authenticated using (public.olympic_can_manage_subject(subject_id)) with check (public.olympic_can_manage_subject(subject_id));

drop policy if exists olympic_teacher_subjects_select on public.olympic_teacher_subjects;
create policy olympic_teacher_subjects_select on public.olympic_teacher_subjects for select to authenticated using (public.olympic_is_admin() or profile_id=auth.uid());
drop policy if exists olympic_teacher_subjects_admin_write on public.olympic_teacher_subjects;
create policy olympic_teacher_subjects_admin_write on public.olympic_teacher_subjects for all to authenticated using (public.olympic_is_admin()) with check (public.olympic_is_admin());

insert into public.olympic_subjects (code,name,short_name,description,order_index) values
 ('algebra','Đại số','Đại số','Ma trận, đại số tuyến tính, đa thức và các bài toán rời rạc trong Olympic Toán sinh viên.',10),
 ('calculus','Giải tích','Giải tích','Các chủ đề giải tích phục vụ luyện thi Olympic Toán sinh viên.',20)
on conflict (code) do update set name=excluded.name,short_name=excluded.short_name,description=excluded.description,order_index=excluded.order_index;

insert into public.olympic_sections (subject_id,name,description,order_index)
select s.id,v.name,v.description,v.order_index from public.olympic_subjects s
join (values
 ('algebra','Ma trận & hệ tuyến tính','Định thức, hệ phương trình, hạng và các kỹ thuật ma trận.',10),
 ('algebra','Cấu trúc tuyến tính & phổ','Vết, giá trị riêng, Cayley–Hamilton và lũy thừa ma trận.',20),
 ('algebra','Đa thức','Nghiệm, Viète–Newton, nội suy, hợp thành và các kỹ thuật đa thức.',30),
 ('algebra','Tổ hợp & mô hình hóa','Các bài toán đếm, cấu hình rời rạc và mô hình hóa.',40),
 ('algebra','Đề Olympic','Bài tổng hợp và đề thi chọn lọc.',50),
 ('calculus','Giới hạn & liên tục','Dãy số, giới hạn và tính liên tục.',10),
 ('calculus','Đạo hàm & cực trị','Đạo hàm, định lý giá trị trung bình và các bài toán cực trị.',20),
 ('calculus','Tích phân','Kỹ thuật tích phân và các bài toán đánh giá tích phân.',30),
 ('calculus','Chuỗi & xấp xỉ','Chuỗi số, chuỗi hàm và các kỹ thuật xấp xỉ.',40),
 ('calculus','Bất đẳng thức & bài tổng hợp','Các bài toán giải tích tổng hợp và bất đẳng thức.',50),
 ('calculus','Đề Olympic','Bài tổng hợp và đề thi chọn lọc.',60)
) as v(code,name,description,order_index) on v.code=s.code
where not exists (select 1 from public.olympic_sections x where x.subject_id=s.id and x.name=v.name);
