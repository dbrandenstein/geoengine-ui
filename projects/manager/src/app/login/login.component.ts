import {Component, Inject} from '@angular/core';
import {Router} from '@angular/router';
import {AppConfig} from '../app-config.service';
import {UserService} from '@geoengine/common';
import {ResponseError} from '@geoengine/openapi-client';
import {MatSnackBar} from '@angular/material/snack-bar';

@Component({
    selector: 'geoengine-manager-login',
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
})
export class LoginComponent {
    email = '';
    password = '';

    constructor(
        private readonly router: Router,
        private readonly userService: UserService,
        private readonly snackBar: MatSnackBar,
        @Inject(AppConfig) readonly config: AppConfig,
    ) {}

    async login(): Promise<void> {
        try {
            await this.userService.login({email: this.email, password: this.password});
            this.router.navigate(['navigation']);
        } catch (error) {
            const e = error as ResponseError;
            const errorJson = await e.response.json().catch(() => ({}));
            const errorMessage = errorJson.message ?? 'Login failed.';
            this.snackBar.open(errorMessage, 'Close', {panelClass: ['error-snackbar']});
        }
    }
}
