import React, { useRef } from "react";
import MatchList from "../components/MatchList";
import ChatRoomSticky from "../components/ChatRoomSticky";

export default function HomePage() {
  const listWrapRef = useRef(null);

  return (
    <div className="page-90vh grid grid-cols-1 lg:grid-cols-2 gap-2 overflow-hidden mt-[6px] min-h-0">
      {/* Sol sütun: maç listesi */}
      <div
        ref={listWrapRef}
        className="h-full overflow-y-auto min-w-0"
        style={{ scrollBehavior: "smooth" }}
      >
        <MatchList />
      </div>

      {/* Sağ sütun: sadece desktop için global chat */}
      <div
        id="chat-root"
        className="hidden lg:flex h-full min-w-0 flex-col min-h-0"
      >
        <div className="flex-1 min-h-0">
          <ChatRoomSticky room="global" />
        </div>
      </div>
    </div>
  );
}