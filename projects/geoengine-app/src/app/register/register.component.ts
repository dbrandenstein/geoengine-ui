import {BehaviorSubject, Observable} from 'rxjs';

import {AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';

import {Config, NotificationService, UserService, WaveValidators, BackendService} from 'wave-core';
import {map, mergeMap} from 'rxjs/operators';
import {Router} from '@angular/router';

@Component({
    selector: 'wave-app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent implements OnInit, AfterViewInit, OnDestroy {
    PASSWORD_MIN_LENGTH = 8;

    loading$ = new BehaviorSubject<boolean>(false);
    notLoading$ = this.loading$.pipe(map((loading) => !loading));
    formIsInvalid$: Observable<boolean>;

    registrationError$ = new BehaviorSubject<string>('');

    registrationForm: FormGroup;

    constructor(
        private readonly config: Config,
        private readonly userService: UserService,
        private readonly backend: BackendService,
        private readonly notificationService: NotificationService,
        private readonly router: Router,
    ) {
        this.registrationForm = new FormGroup({
            name: new FormControl('', Validators.required),
            email: new FormControl(
                '',
                Validators.compose([Validators.required, Validators.email, WaveValidators.keyword([this.config.USER.GUEST.NAME])]),
            ),
            password: new FormControl('', [Validators.required, Validators.minLength(this.PASSWORD_MIN_LENGTH)]),
        });

        this.formIsInvalid$ = this.registrationForm.statusChanges.pipe(map((status) => status !== 'VALID'));
    }

    ngOnInit(): void {}

    ngAfterViewInit(): void {
        // do this once for observables
        setTimeout(() => this.registrationForm.updateValueAndValidity());
    }

    ngOnDestroy(): void {}

    register(): void {
        this.loading$.next(true);
        this.registrationError$.next('');

        const realName: string = this.registrationForm.controls['name'].value;
        const email: string = this.registrationForm.controls['email'].value;
        const password: string = this.registrationForm.controls['password'].value;

        this.backend
            .registerUser({
                email,
                password,
                realName,
            })
            .pipe(mergeMap(() => this.userService.login({email, password})))
            .subscribe(
                () => {
                    // success
                    this.notificationService.info('Registration successful!');
                    this.redirectToMainView();
                },
                (error) => {
                    // on error
                    this.registrationError$.next(error.error.message);

                    this.loading$.next(false);
                },
            );
    }

    redirectToMainView(): void {
        this.router.navigate(['map']);
    }
}
