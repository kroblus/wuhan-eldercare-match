/**
 * 应用入口保持匿名优先。
 *
 * 浏览首页、机构、图片、VR 和填写评估不需要登录；登录、手机号授权和真实预约
 * 会在对应业务契约冻结后，由具体场景按需触发。
 */
import { initializeApplication } from './runtime/application'
initializeApplication()
