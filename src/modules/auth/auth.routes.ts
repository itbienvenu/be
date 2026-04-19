import { Router } from "express";
import AuthController from "./auth.controller.js";

export class AuthRoutes {
    public router: Router;
    private authController: AuthController;

    constructor() {
        this.router = Router();
        this.authController = new AuthController();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post("/register", (req, res) => this.authController.register(req, res));
        this.router.post("/login", (req, res) => this.authController.login(req, res));
        this.router.post("/refresh", (req, res) => this.authController.refresh(req, res));
    }
}

export default AuthRoutes;