import NextAuth, { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const NOTION_TOKEN = process.env.NOTION_TOKEN;

// [NEW] 노션 유저 데이터 타입 정의 (any 제거용)
interface NotionUser {
  object: string;
  id: string;
  type: string;
  person?: {
    email: string;
  };
  name?: string;
  avatar_url?: string;
}

// 노션 워크스페이스 멤버 목록에서 이메일 찾기
async function checkNotionUser(email: string) {
  if (!NOTION_TOKEN) return false;

  try {
    const res = await fetch("https://api.notion.com/v1/users", {
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return false;

    const data = await res.json();
    // [수정] 타입 단언(Assertion)을 사용하여 any 회피
    const users: NotionUser[] = data.results || [];

    const foundUser = users.find(
      (u) => u.type === "person" && u.person?.email === email
    );

    return !!foundUser;
  } catch (e) {
    console.error("Notion Auth Error:", e);
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }: { user: User }) {
      if (!user.email) return false;

      console.log(`Login attempt: ${user.email}`);
      const isAllowed = await checkNotionUser(user.email);

      if (!isAllowed) {
        console.log(
          `❌ Access Denied: ${user.email} is not in Notion Workspace.`
        );
        return false;
      }

      console.log(`✅ Access Granted: ${user.email}`);
      return true;
    },
  },
  // 디버깅을 위해 추가
  debug: true,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
