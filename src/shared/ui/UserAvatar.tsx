import userAvatar from "@/assets/user-avatar.png";
import styles from "./UserAvatar.module.css";

export function UserAvatar() {
  return (
    <img className={styles.avatar} src={userAvatar} alt="" draggable={false} />
  );
}
