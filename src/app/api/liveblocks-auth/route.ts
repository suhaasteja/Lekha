import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";
import { auth, currentUser } from "@clerk/nextjs/server";
import { api } from "../../../../convex/_generated/api";
const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(req: Request) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const { sessionClaims, getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (token) {
    convex.setAuth(token);
  }
  const user = await currentUser();
  const { room, guestId } = await req.json();
  const document = await convex.query(api.documents.getById, { id: room, guestId });

  if (!document) {
    return new Response("Unauthorized", { status: 401 });
  }

  const isGuestDocument = document.ownerId.startsWith("guest:");

  if (isGuestDocument) {
    const guestToken = typeof guestId === "string" && guestId ? guestId : "anonymous";
    const label = guestToken.slice(0, 6);
    const hue =
      Array.from(guestToken).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
    const session = liveblocks.prepareSession(`guest:${guestToken}`, {
      userInfo: {
        name: `Guest ${label}`,
        avatar: "",
        color: `hsl(${hue}, 80%, 60%)`,
      },
    });
    session.allow(room, session.FULL_ACCESS);
    const { body, status } = await session.authorize();
    return new Response(body, { status });
  }

  if (!sessionClaims || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const isOwner = document.ownerId === user.id;
  const isOrganizationMember = !!(
    document.organizationId && document.organizationId === sessionClaims.org_id
  );
  if (!isOwner && !isOrganizationMember) {
    return new Response("Unauthorized", { status: 401 });
  }

  const name = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Anonymous";
  const nameToNumber = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = Math.abs(nameToNumber) % 360
  const color = `hsl(${hue}, 80%, 60%)`;
  
  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name,
      avatar: user.imageUrl,
      color,
    },
  });
  session.allow(room, session.FULL_ACCESS);
  const { body, status } = await session.authorize();

  return new Response(body, { status });
}
