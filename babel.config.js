module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Ya no es necesario añadir "expo-router/babel" aquí.
    // El preset "babel-preset-expo" ya lo incluye todo.
    plugins: [],
  };
};

