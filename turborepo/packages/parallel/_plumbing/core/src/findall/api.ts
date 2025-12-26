import type Parallel from "parallel-web";
import type { FindAllRun, FindAllSpec } from "./schemas";

export async function findAllIngest(client: Parallel, query: string) {
  return client.post<FindAllSpec>("/v1beta/findall/ingest", {
    body: { query },
  });
}

export async function findAllStartRun(
  client: Parallel,
  params: {
    findall_spec: FindAllSpec;
    processor: "base" | "pro";
    result_limit?: number;
  }
) {
  return client.post<{ findall_id: string; status: string }>(
    "/v1beta/findall/runs",
    { body: params }
  );
}

export async function findAllGetRun(client: Parallel, findallId: string) {
  return client.get<FindAllRun>(`/v1beta/findall/runs/${findallId}`);
}

export async function findAllCancel(client: Parallel, findallId: string) {
  return client.post<{ ok: boolean }>("/v1beta/findall/runs/cancel", {
    body: { findall_id: findallId },
  });
}

export async function findAllExtend(
  client: Parallel,
  findallId: string,
  numEntities: number
) {
  return client.post<{ ok: boolean }>("/v1beta/findall/runs/extend", {
    body: { findall_id: findallId, num_entities: numEntities },
  });
}
