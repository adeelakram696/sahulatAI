-- Provider skill tier: certifications and tools_required fields.
-- certifications: e.g. ['EPA 608', 'Gas Safe', 'NEC Wiring']
-- tools_required: e.g. ['vacuum pump', 'multimeter', 'pipe cutter']
-- Both drive the specialization bonus in the ranking agent.

alter table providers
  add column if not exists certifications text[] not null default '{}',
  add column if not exists tools_required  text[] not null default '{}';
