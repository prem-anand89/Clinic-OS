import type { Patient, MrnoSource, UUID } from '@/domain/types';
import type { Repos } from '@/repositories/types';

export interface NewPatientInput {
  clinicId: UUID;
  mrno?: string;
  name: string;
  age?: number | null;
  sex?: 'M' | 'F' | 'Other' | null;
  phone?: string | null;
  primaryCondition?: string | null;
}

/**
 * MRNO policy (confirmed with user): normally the hospital issues the MRNO
 * and it is typed in; walk-ins without a hospital registration get an
 * app-generated one, visibly prefixed so the two never collide.
 */
function generateWalkInMrno(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `W-${ymd}-${rand}`;
}

export function createPatientService(repos: Repos) {
  return {
    async create(input: NewPatientInput): Promise<Patient> {
      const manual = input.mrno?.trim();
      let mrno: string;
      let mrnoSource: MrnoSource;
      if (manual) {
        const existing = await repos.patients.getByMrno(input.clinicId, manual);
        if (existing) throw new Error(`MRNO ${manual} already exists (${existing.name}).`);
        mrno = manual;
        mrnoSource = 'hospital';
      } else {
        do {
          mrno = generateWalkInMrno();
        } while (await repos.patients.getByMrno(input.clinicId, mrno));
        mrnoSource = 'auto';
      }

      const patient: Patient = {
        id: crypto.randomUUID(),
        clinicId: input.clinicId,
        mrno,
        mrnoSource,
        name: input.name.trim(),
        age: input.age ?? null,
        sex: input.sex ?? null,
        phone: input.phone?.trim() || null,
        primaryCondition: input.primaryCondition?.trim() || null,
        updatedAt: new Date().toISOString(),
      };
      await repos.patients.put(patient);
      return patient;
    },
  };
}
