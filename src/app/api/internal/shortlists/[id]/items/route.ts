import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import {
  addToShortlist,
  removeFromShortlist,
  setShortlistNote,
} from "@/server/repositories/workspace-repository";

const AddItem = z.object({
  influencerId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

const NoteInput = z.object({
  influencerId: z.string().min(1),
  note: z.string().trim().max(500).nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("shortlist:write");
    const { id } = await params;
    const parsed = AddItem.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse("validation_failed", "An influencer id is required.");
    }
    return NextResponse.json(
      addToShortlist(user, id, parsed.data.influencerId, parsed.data.note),
    );
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("shortlist:write");
    const { id } = await params;
    const parsed = NoteInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse("validation_failed", "A note field is required.");
    }
    return NextResponse.json(
      setShortlistNote(user, id, parsed.data.influencerId, parsed.data.note),
    );
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("shortlist:write");
    const { id } = await params;
    const influencerId = new URL(request.url).searchParams.get("influencerId");
    if (!influencerId) {
      return errorResponse("validation_failed", "An influencer id is required.");
    }
    return NextResponse.json(removeFromShortlist(user, id, influencerId));
  });
}
