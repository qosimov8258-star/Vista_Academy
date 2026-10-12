/**
 * iOS uslubidagi sahifalar uchun ikonkalar — lucide, Sabot veb paneli bilan
 * bir xil to'plam (qalinligi 2, yumaloq uchlar).
 *
 * Nomlar `components/ui/icons` dagi bilan BIR XIL: iOS sahifasiga o'tkazishda
 * faqat import manzili almashadi (`@/components/ui/icons` → shu fayl), kod
 * o'zgarmaydi. Qaysi lucide belgisi qaysi ma'noga — shu yerda bir marta
 * belgilanadi, sahifalar o'zaro bir xil bo'lib turadi.
 *
 * Yon panel (sidebar) hali eski to'plamda: unda faol bo'lim to'ldirilgan
 * (`filled`) belgi bilan ajratiladi, lucide'da bunday variant yo'q.
 */
import type { LucideProps } from "lucide-react";

export type IconProps = LucideProps;

export {
  CircleAlert as AlertIcon,
  ArrowLeft as ArrowLeftIcon,
  Bell as BellIcon,
  BriefcaseBusiness as BriefcaseIcon,
  School as BuildingIcon,
  CalendarDays as CalendarIcon,
  Camera as CameraIcon,
  ChartColumn as ChartIcon,
  Check as CheckIcon,
  ClipboardCheck as ChecklistIcon,
  ChevronRight as ChevronRightIcon,
  Baby as ChildIcon,
  Clock as ClockIcon,
  X as CloseIcon,
  Copy as CopyIcon,
  FileText as DocumentIcon,
  DoorOpen as DoorIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Globe as GlobeIcon,
  UsersRound as GroupIcon,
  Info as InfoIcon,
  KeyRound as KeyIcon,
  Lock as LockIcon,
  LogOut as LogoutIcon,
  Utensils as MealIcon,
  Wallet as MoneyIcon,
  NotebookPen as NoteIcon,
  Phone as PhoneIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  IdCard as TeacherIcon,
  Trash2 as TrashIcon,
  UserRound as UserIcon,
} from "lucide-react";
