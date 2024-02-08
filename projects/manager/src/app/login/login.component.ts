import {Component, Inject} from '@angular/core';
import {Router} from '@angular/router';
import {SessionService} from '../../../../common/src/lib/session/session.service';
import {AppConfig} from '../app-config.service';

@Component({
    selector: 'geoengine-manager-login',
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
})
export class LoginComponent {
    email = '';
    password = '';

    constructor(
        private router: Router,
        private sessionService: SessionService,
        @Inject(AppConfig) readonly config: AppConfig,
    ) {}

    login(): void {
        this.sessionService
            .login({email: this.email, password: this.password})
            .then((_session) => this.router.navigate(['navigation']))
            .catch((error) => console.error(error));
    }
}
