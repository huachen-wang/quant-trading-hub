import type { AllocationDraft as ContractAllocationDraft } from "@/shared/v2/contracts";

export type AllocationDraft = ContractAllocationDraft;
export type AllocationBucket = AllocationDraft["platformBuckets"][number];
export type AllocationStrategy = AllocationBucket["strategies"][number];
