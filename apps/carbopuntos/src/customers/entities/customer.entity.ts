import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Tabla central de clientes fidelizados del hub carbopuntos.
// synchronize:false — cambios solo por migración.
@Entity('customers')
@Unique(['dni'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // DNI: 8 dígitos, único en el hub (D11 — no DNI duplicado entre sedes).
  @Column({ name: 'dni', type: 'varchar', length: 8 })
  dni!: string;

  @Column({ name: 'first_name', type: 'varchar' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar' })
  lastName!: string;

  // Nombre completo tal cual retorna json.pe (RN-05).
  @Column({ name: 'full_name', type: 'varchar' })
  fullName!: string;

  // Teléfono: opcional, no único (D23).
  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone!: string | null;

  // Momento en que el cliente otorgó consentimiento (D10 — requerido).
  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt!: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
