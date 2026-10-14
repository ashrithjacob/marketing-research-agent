import { Link, paths } from './route';

export default function HeaderNav() {
  return (
    <>
      <Link to={paths.library()} className="chip">
        Library
      </Link>
      <Link to={paths.inbox()} className="chip">
        Inbox
      </Link>
      <Link to={paths.playbooks()} className="chip">
        Playbooks
      </Link>
    </>
  );
}
