import { ShareModal } from "@/components/ShareModal";
import { VipReferralProgress } from "@/components/VipReferralProgress";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
}

export function InviteFriendsModal({ open, onClose, url }: Props) {
  return (
    <ShareModal
      open={open}
      onClose={onClose}
      url={url}
      title="Zaproś znajomych"
      subtitle="Wyślij link znajomym - dostaniesz punkty i odznaki, kiedy dołączą."
      shareText="Dołącz do mnie na poŻeramy - znajdźmy razem najlepsze knajpy w Poznaniu!"
      extra={<VipReferralProgress compact />}
    />
  );
}
