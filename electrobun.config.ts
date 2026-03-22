import { type ElectrobunConfig } from "./src/config";

const config: ElectrobunConfig = {
  name: "MyElectrobunApp",
  version: "1.0.0",
  author: "Test Author",
  windows: {
    icon: "assets/app.ico",
    productId: "com.example.electrobun",
    installDir: "MyApp"
  },
  views: {
    mainview: {
      url: "views://mainview/index.html"
    }
  }
};

export default config;
