export type PreviewTicket = {
  url: string;
  filename: string;
  mimeType: string | null;
};

export async function requestPreviewTicket(fileId: string): Promise<
  | { ok: true; ticket: PreviewTicket }
  | { ok: false; status: number; message: string }
> {
  const response = await fetch(`/api/previews/${fileId}`, { credentials: "same-origin" });
  if (response.status === 401) {
    return { ok: false, status: 401, message: "Sign in to preview this file." };
  }
  if (response.status === 403) {
    return { ok: false, status: 403, message: "Verify your email to preview this file." };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, message: "This preview is not available." };
  }

  const body = (await response.json()) as { url?: string; filename?: string; mimeType?: string | null };
  if (!body.url || !body.filename) {
    return { ok: false, status: 500, message: "This preview is not available." };
  }

  return {
    ok: true,
    ticket: {
      url: body.url,
      filename: body.filename,
      mimeType: body.mimeType ?? null,
    },
  };
}

export async function fetchPreviewBytes(fileId: string): Promise<
  | { ok: true; buffer: ArrayBuffer; filename: string; mimeType: string | null }
  | { ok: false; status: number; message: string }
> {
  const ticket = await requestPreviewTicket(fileId);
  if (!ticket.ok) {
    return ticket;
  }

  const fileResponse = await fetch(ticket.ticket.url);
  if (!fileResponse.ok) {
    return { ok: false, status: fileResponse.status, message: "The preview link expired. Try again." };
  }

  return {
    ok: true,
    buffer: await fileResponse.arrayBuffer(),
    filename: ticket.ticket.filename,
    mimeType: ticket.ticket.mimeType,
  };
}
