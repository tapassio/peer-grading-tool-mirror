import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../interfaces';
/**
 * this service handles all things regarding super user functionality
 */
@Injectable({
  providedIn: 'root',
})
export class SuperService {
  private http = inject(HttpClient);


  getAdmins(): Observable<User[]> {
    return this.http.get<User[]>(environment.api + '/user/admins');
  }

  createAdmin(admin: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    company?: string;
  }): Observable<User> {
    return this.http.post<User>(environment.api + '/user/admin', admin);
  }

  deleteAdmin(admin: { email: string }): Observable<User> {
    return this.http.delete<User>(environment.api + '/user', { body: admin });
  }

  getAdminById(id: number): Observable<User> {
    return this.http.get<User>(environment.api + '/user/' + id);
  }

  updateAdmin(admin: User): Observable<User> {
    return this.http.post<User>(environment.api + '/user/admin/update', admin);
  }
}
