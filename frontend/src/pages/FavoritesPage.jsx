import React from "react";
import MatchList from "../components/MatchList";

const FavoritesPage = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Favori Maçlar</h1>
      <MatchList onlyFavorites />
    </div>
  );
};

export default FavoritesPage;
