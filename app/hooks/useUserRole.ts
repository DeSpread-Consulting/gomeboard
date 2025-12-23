import { usePrivy } from "@privy-io/react-auth";

export type UserRole = "guest" | "external" | "internal";

export function useUserRole(): UserRole {
  const { user, ready, authenticated } = usePrivy();

  // 1. 로딩 중이거나 로그인이 안 된 상태
  if (!ready || !authenticated || !user) return "guest";

  // 2. 사용자의 이메일 정보 가져오기 (이메일, 구글, 애플 로그인 모두 확인)
  // Privy user 객체에서 사용 가능한 이메일을 순서대로 찾습니다.
  const email = user.email?.address || user.google?.email || user.apple?.email;

  // 3. 권한 판별 로직
  if (email) {
    // [핵심] 이메일이 @despread.io 로 끝나면 내부 직원(internal)
    if (email.endsWith("@despread.io")) {
      return "internal";
    }

    // (선택사항) 테스트를 위해 특정 개인 이메일도 내부자로 추가하고 싶다면 아래처럼 추가 가능
    // if (email === "gome@gmail.com") return "internal";
  }

  // 4. 그 외의 모든 로그인 유저는 외부 사용자(external)
  return "external";
}
