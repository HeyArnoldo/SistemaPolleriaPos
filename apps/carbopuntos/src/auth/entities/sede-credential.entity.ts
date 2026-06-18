import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Credencial de acceso por sede al hub carbopuntos.
// service_key_hash: hash bcryptjs del service key (nunca se almacena el key plano).
@Entity('sede_credentials')
@Unique(['sede'])
export class SedeCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Identificador de sede: urubamba, pisac, calca, etc.
  @Column({ name: 'sede', type: 'varchar' })
  sede!: string;

  // Hash bcryptjs del service key de la sede.
  @Column({ name: 'service_key_hash', type: 'varchar' })
  serviceKeyHash!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
