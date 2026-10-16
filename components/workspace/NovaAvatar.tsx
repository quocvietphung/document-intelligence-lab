import Image from "next/image";

/** Decorative, fictional AI portrait. The surrounding text identifies Nova. */
export function NovaAvatar() {
  return <Image className="nova-profile-image" src="/images/nova-avatar-v2.webp" alt="" width={96} height={96} unoptimized draggable={false}/>;
}
