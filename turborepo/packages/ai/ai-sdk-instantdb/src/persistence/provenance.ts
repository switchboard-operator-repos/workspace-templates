export type AiProvenanceRef = {
  trajectoryId: string;
  uiMessagePartId: string;
};

export function linkProvenanceField(fieldName: string, ref: AiProvenanceRef) {
  return {
    field: fieldName,
    value: {
      trajectoryId: ref.trajectoryId,
      uiMessagePartId: ref.uiMessagePartId,
    },
  } as const;
}
