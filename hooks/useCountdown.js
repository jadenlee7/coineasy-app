import { useEffect, useState } from "react";

export default function useCountdown(endTime) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!endTime) return;

    const target = new Date(endTime);

    const update = () => {
      const now = new Date();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft(null);
      } else {
        const hours = String(Math.floor(diff / 3600000)).padStart(2, "0");
        const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
        const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
        setTimeLeft(`${hours}:${minutes}:${seconds}`);
      }
    };

    update(); // exécuter tout de suite au montage
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  return timeLeft;
}
