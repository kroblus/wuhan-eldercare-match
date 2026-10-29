import { createElement, type ComponentProps } from 'react';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  HomeOutlined,
  FileTextOutlined,
  MenuOutlined,
  LogoutOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
function decorative(Icon: typeof DashboardOutlined) {
  return (props: ComponentProps<typeof DashboardOutlined>) =>
    createElement(Icon, { ...props, 'aria-hidden': true });
}
export const IconDashboard = decorative(DashboardOutlined);
export const IconList = decorative(UnorderedListOutlined);
export const IconCalendar = decorative(CalendarOutlined);
export const IconHome = decorative(HomeOutlined);
export const IconFile = decorative(FileTextOutlined);
export const IconMenu = decorative(MenuOutlined);
export const IconExport = decorative(LogoutOutlined);
export const IconArrowRight = decorative(ArrowRightOutlined);
export const IconArrowLeft = decorative(ArrowLeftOutlined);
export const IconRefresh = decorative(ReloadOutlined);
export const IconSearch = decorative(SearchOutlined);
export const IconPlus = decorative(PlusOutlined);
export const IconDelete = decorative(DeleteOutlined);
export const IconDownload = decorative(DownloadOutlined);
